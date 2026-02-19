import { Prisma, type AgentExternalOrder, type DataPlan, type Network, type Order, type User } from "@prisma/client";
import { randomBytes } from "crypto";
import { prisma } from "@/backend/lib/db/prisma";
import { applyAgentDiscount, getAgentPricingContext, resolvePriceForUser } from "@/backend/services/agentPricingService";
import {
  MAX_RESELLER_QTY,
  buildIdempotencyKey,
  calculateResellerOrderTotal,
  isInsufficientBalance,
  isValidResellerQty,
  roundMoney
} from "@/backend/services/reseller/orderRules";
import { mapToResellerStatus, maskPhoneNumber, serializeOrderTimestamp } from "@/backend/services/reseller/format";
import { enqueueWebhookIfStatusChanged } from "@/backend/services/reseller/statusHooks";

function generateOrderNumber(): string {
  return `GH-AG-${Date.now()}-${randomBytes(2).toString("hex")}`;
}

function normalizeStatusFilter(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return normalized;
}

function serializeService(plan: DataPlan & { network: Network }) {
  return {
    service_id: plan.id,
    network: plan.network.displayName,
    plan_name: plan.name,
    volume: plan.dataAmount,
    price: plan.price,
    min_qty: 1,
    max_qty: MAX_RESELLER_QTY,
    updated_at: plan.updatedAt.toISOString(),
    status: plan.isActive ? "active" : "inactive"
  };
}

function serializeExternalOrder(
  externalOrder: AgentExternalOrder & {
    order: Order & { dataPlan: DataPlan; network: Network };
  }
) {
  const order = externalOrder.order;
  return {
    order_id: order.id,
    client_order_id: externalOrder.clientOrderId,
    status: mapToResellerStatus(order.status, order.paymentStatus),
    amount: order.amount,
    currency: order.currency,
    qty: Number((externalOrder.metadata as { qty?: number } | null)?.qty ?? 1),
    phone: maskPhoneNumber(order.recipientNumber),
    provider_ref: externalOrder.providerRef,
    service: {
      service_id: externalOrder.serviceId,
      network: order.network.displayName,
      plan_name: order.dataPlan.name,
      volume: order.dataPlan.dataAmount
    },
    ...serializeOrderTimestamp(order)
  };
}

export async function listResellerServices(agentId: string, options: {
  network?: string | null;
  page: number;
  limit: number;
}): Promise<{
  data: ReturnType<typeof serializeService>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}> {
  const where: Prisma.DataPlanWhereInput = {
    isActive: true,
    ...(options.network
      ? {
          network: {
            OR: [
              { name: { equals: options.network, mode: "insensitive" } },
              { displayName: { contains: options.network, mode: "insensitive" } }
            ]
          }
        }
      : {})
  };

  const [plans, total] = await Promise.all([
    prisma.dataPlan.findMany({
      where,
      include: { network: true },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      skip: (options.page - 1) * options.limit,
      take: options.limit
    }),
    prisma.dataPlan.count({ where })
  ]);

  const pricingContext = await getAgentPricingContext(agentId);
  const data = plans.map((plan) => {
    const price = pricingContext.isAgent
      ? applyAgentDiscount(plan.price, pricingContext.discountPercent)
      : roundMoney(plan.price);
    return serializeService({ ...plan, price });
  });

  return {
    data,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      has_more: options.page * options.limit < total
    }
  };
}

export async function getAgentWalletBalance(agentId: string): Promise<{
  agent_id: string;
  wallet_balance: number;
  currency: string;
}> {
  const wallet = await prisma.walletBalance.findUnique({
    where: { userId: agentId }
  });

  return {
    agent_id: agentId,
    wallet_balance: wallet?.currentBalance ?? 0,
    currency: "GHS"
  };
}

type CreateOrderInput = {
  agent: Pick<User, "id" | "username">;
  credentialId: string;
  serviceId: string;
  phone: string;
  qty: number;
  clientOrderId: string;
};

export async function createResellerOrder(input: CreateOrderInput): Promise<{
  idempotent: boolean;
  order: ReturnType<typeof serializeExternalOrder>;
}> {
  const clientOrderId = input.clientOrderId.trim();
  if (!clientOrderId) {
    const error = new Error("Invalid client_order_id.");
    (error as Error & { code?: string }).code = "INVALID_REQUEST";
    throw error;
  }
  const idempotencyKey = buildIdempotencyKey(input.agent.id, clientOrderId);

  const existing = await prisma.agentExternalOrder.findUnique({
    where: {
      agentId_clientOrderId: {
        agentId: input.agent.id,
        clientOrderId
      }
    },
    include: {
      order: {
        include: {
          dataPlan: true,
          network: true
        }
      }
    }
  });

  if (existing) {
    await enqueueWebhookIfStatusChanged(existing.orderId);
    return {
      idempotent: true,
      order: serializeExternalOrder(existing)
    };
  }

  if (!isValidResellerQty(input.qty)) {
    const error = new Error("Invalid quantity.");
    (error as Error & { code?: string }).code = "INVALID_QTY";
    throw error;
  }

  const phone = input.phone.trim();
  if (!/^\d{10,15}$/.test(phone)) {
    const error = new Error("Invalid phone number.");
    (error as Error & { code?: string }).code = "INVALID_PHONE";
    throw error;
  }

  const plan = await prisma.dataPlan.findFirst({
    where: {
      id: input.serviceId,
      isActive: true
    },
    include: {
      network: true
    }
  });

  if (!plan) {
    const error = new Error("Service not found.");
    (error as Error & { code?: string }).code = "SERVICE_NOT_FOUND";
    throw error;
  }

  const unitPrice = await resolvePriceForUser(plan.price, input.agent.id);
  const totalAmount = calculateResellerOrderTotal(unitPrice, input.qty);

  let result: AgentExternalOrder & {
    order: Order & {
      dataPlan: DataPlan;
      network: Network;
    };
  };

  try {
    result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.walletBalance.findUnique({
        where: { userId: input.agent.id }
      });

      const currentBalance = wallet?.currentBalance ?? 0;
      if (isInsufficientBalance(currentBalance, totalAmount)) {
        const error = new Error("Wallet balance is too low for this order.");
        (error as Error & { code?: string }).code = "INSUFFICIENT_BALANCE";
        throw error;
      }

      // Deduct wallet as soon as possible (before creating order)
      const orderNumber = generateOrderNumber();
      const balanceAfter = roundMoney(currentBalance - totalAmount);

      await tx.walletBalance.upsert({
        where: { userId: input.agent.id },
        create: {
          userId: input.agent.id,
          totalAdded: wallet?.totalAdded ?? 0,
          totalSpent: totalAmount,
          currentBalance: balanceAfter
        },
        update: {
          totalSpent: { increment: totalAmount },
          currentBalance: balanceAfter
        }
      });

      await tx.walletTransaction.create({
        data: {
          userId: input.agent.id,
          type: "SPENT",
          amount: totalAmount,
          balanceBefore: currentBalance,
          balanceAfter,
          description: `Reseller API order ${orderNumber}`
        }
      });

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: input.agent.id,
          networkId: plan.networkId,
          dataPlanId: plan.id,
          status: "PENDING",
          amount: totalAmount,
          currency: plan.currency,
          paymentMethod: "WALLET",
          paymentStatus: "COMPLETED",
          recipientNumber: phone,
          apiRequestPayload: {
            source: "reseller_api",
            qty: input.qty,
            unitPrice,
            clientOrderId,
            idempotencyKey,
            credentialId: input.credentialId
          }
        }
      });

      return tx.agentExternalOrder.create({
        data: {
          agentId: input.agent.id,
          credentialId: input.credentialId,
          orderId: order.id,
          serviceId: plan.id,
          clientOrderId,
          metadata: {
            qty: input.qty,
            unitPrice,
            network: plan.network.displayName,
            plan: plan.name,
            idempotencyKey
          }
        },
        include: {
          order: {
            include: {
              dataPlan: true,
              network: true
            }
          }
        }
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const racedExisting = await prisma.agentExternalOrder.findUnique({
        where: {
          agentId_clientOrderId: {
            agentId: input.agent.id,
            clientOrderId
          }
        },
        include: {
          order: {
            include: {
              dataPlan: true,
              network: true
            }
          }
        }
      });
      if (racedExisting) {
        await enqueueWebhookIfStatusChanged(racedExisting.orderId);
        return {
          idempotent: true,
          order: serializeExternalOrder(racedExisting)
        };
      }
    }
    throw error;
  }

  queueResellerOrderFulfillment(result.orderId);
  await enqueueWebhookIfStatusChanged(result.orderId);

  return {
    idempotent: false,
    order: serializeExternalOrder(result)
  };
}

function queueResellerOrderFulfillment(orderId: string): void {
  setTimeout(async () => {
    try {
      await prisma.order.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: { status: "PROCESSING" }
      });

      const { dataProviderService } = await import("@/backend/services/dataProvider/dataProviderService");
      const result = await dataProviderService.fulfillOrder(orderId);

      if (result.reference) {
        await prisma.agentExternalOrder.updateMany({
          where: { orderId },
          data: { providerRef: result.reference }
        });
      }

      await enqueueWebhookIfStatusChanged(orderId);
    } catch (error) {
      console.error("Reseller API fulfillment queue error:", error);
    }
  }, 0);
}

export async function getAgentExternalOrder(
  agentId: string,
  orderId: string,
  syncStatus = true
): Promise<ReturnType<typeof serializeExternalOrder> | null> {
  const externalOrder = await prisma.agentExternalOrder.findFirst({
    where: {
      agentId,
      orderId
    },
    include: {
      order: {
        include: {
          dataPlan: true,
          network: true
        }
      }
    }
  });

  if (!externalOrder) return null;

  if (syncStatus && externalOrder.order.status === "PROCESSING") {
    try {
      const { dataProviderService } = await import("@/backend/services/dataProvider/dataProviderService");
      await dataProviderService.syncOrderStatus(externalOrder.orderId);
    } catch (error) {
      console.error("Reseller order sync warning:", error);
    }
  }

  const refreshed = await prisma.agentExternalOrder.findUnique({
    where: { id: externalOrder.id },
    include: {
      order: {
        include: {
          dataPlan: true,
          network: true
        }
      }
    }
  });

  if (!refreshed) return null;

  await enqueueWebhookIfStatusChanged(refreshed.orderId);
  return serializeExternalOrder(refreshed);
}

export async function listAgentExternalOrders(input: {
  agentId: string;
  status?: string | null;
  from?: string | null;
  to?: string | null;
  page: number;
  limit: number;
}): Promise<{
  data: Array<ReturnType<typeof serializeExternalOrder>>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}> {
  const dateRange = {
    ...(input.from ? { gte: new Date(input.from) } : {}),
    ...(input.to ? { lte: new Date(input.to) } : {})
  };

  const statusMap: Record<string, Prisma.AgentExternalOrderWhereInput> = {
    pending: { order: { status: "PENDING" } },
    processing: { order: { status: "PROCESSING" } },
    success: { order: { status: "COMPLETED" } },
    failed: { order: { status: "FAILED", paymentStatus: { not: "REFUNDED" } } },
    canceled: { order: { status: "CANCELLED", paymentStatus: { not: "REFUNDED" } } },
    refunded: { order: { paymentStatus: "REFUNDED" } }
  };
  const statusFilter = normalizeStatusFilter(input.status);

  const where: Prisma.AgentExternalOrderWhereInput = {
    agentId: input.agentId,
    ...(Object.keys(dateRange).length > 0 ? { createdAt: dateRange } : {}),
    ...(statusFilter && statusMap[statusFilter] ? statusMap[statusFilter] : {})
  };

  const [rows, total] = await Promise.all([
    prisma.agentExternalOrder.findMany({
      where,
      include: {
        order: {
          include: {
            dataPlan: true,
            network: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit
    }),
    prisma.agentExternalOrder.count({ where })
  ]);

  for (const row of rows) {
    if (row.order.status === "PROCESSING") {
      try {
        const { dataProviderService } = await import("@/backend/services/dataProvider/dataProviderService");
        await dataProviderService.syncOrderStatus(row.orderId);
      } catch {
        // Ignore sync errors for list endpoint.
      }
    }
  }

  const refreshedRows = await prisma.agentExternalOrder.findMany({
    where,
    include: {
      order: {
        include: {
          dataPlan: true,
          network: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    skip: (input.page - 1) * input.limit,
    take: input.limit
  });

  for (const row of refreshedRows) {
    await enqueueWebhookIfStatusChanged(row.orderId);
  }

  return {
    data: refreshedRows.map((row) => serializeExternalOrder(row)),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      has_more: input.page * input.limit < total
    }
  };
}

export async function cancelExternalOrder(agentId: string, orderId: string): Promise<ReturnType<typeof serializeExternalOrder> | null> {
  const externalOrder = await prisma.agentExternalOrder.findFirst({
    where: { agentId, orderId },
    include: {
      order: {
        include: {
          dataPlan: true,
          network: true
        }
      }
    }
  });

  if (!externalOrder) return null;

  if (externalOrder.order.status !== "PENDING") {
    const error = new Error("Order can only be canceled while pending.");
    (error as Error & { code?: string }).code = "CANNOT_CANCEL";
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: externalOrder.orderId },
      data: {
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
        failedReason: "Canceled by reseller API"
      }
    });

    const wallet = await tx.walletBalance.findUnique({ where: { userId: agentId } });
    const before = wallet?.currentBalance ?? 0;
    const after = roundMoney(before + externalOrder.order.amount);

    await tx.walletBalance.upsert({
      where: { userId: agentId },
      create: {
        userId: agentId,
        totalAdded: externalOrder.order.amount,
        totalSpent: 0,
        currentBalance: after
      },
      update: {
        totalSpent: { decrement: externalOrder.order.amount },
        currentBalance: after
      }
    });

    await tx.walletTransaction.create({
      data: {
        userId: agentId,
        type: "ADJUSTED",
        amount: externalOrder.order.amount,
        balanceBefore: before,
        balanceAfter: after,
        description: `Reseller API refund for canceled order ${externalOrder.order.orderNumber}`
      }
    });
  });

  await enqueueWebhookIfStatusChanged(orderId);
  return getAgentExternalOrder(agentId, orderId, false);
}
