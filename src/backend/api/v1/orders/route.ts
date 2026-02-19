import { z } from "zod";
import { NextRequest } from "next/server";
import { withResellerAuth } from "@/backend/api/v1/_lib/handler";
import { resellerError, resellerOk } from "@/backend/services/reseller/response";
import { MAX_RESELLER_QTY } from "@/backend/services/reseller/orderRules";
import { createResellerOrder, listAgentExternalOrders } from "@/backend/services/reseller/orders";

const createOrderSchema = z.object({
  service_id: z.string().min(1),
  phone: z.string().min(10).max(20),
  qty: z.number().int().min(1).max(MAX_RESELLER_QTY).default(1),
  client_order_id: z.string().min(3).max(100)
});

const listStatusSchema = z.enum([
  "pending",
  "processing",
  "success",
  "failed",
  "canceled",
  "refunded"
]);

export async function GET(request: NextRequest) {
  return withResellerAuth(request, async ({ auth }) => {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") ?? 20)));
    const status = searchParams.get("status")?.trim().toLowerCase() || null;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (status) {
      const parsedStatus = listStatusSchema.safeParse(status);
      if (!parsedStatus.success) {
        return resellerError(400, "INVALID_REQUEST", "Invalid status filter.", {
          allowed_statuses: listStatusSchema.options
        });
      }
    }

    const fromDate = from ? new Date(from) : null;
    if (from && Number.isNaN(fromDate?.getTime())) {
      return resellerError(400, "INVALID_REQUEST", "Invalid from date. Use ISO-8601 format.");
    }
    const toDate = to ? new Date(to) : null;
    if (to && Number.isNaN(toDate?.getTime())) {
      return resellerError(400, "INVALID_REQUEST", "Invalid to date. Use ISO-8601 format.");
    }

    const result = await listAgentExternalOrders({
      agentId: auth.agentId,
      status,
      from,
      to,
      page,
      limit
    });

    return resellerOk({
      orders: result.data,
      pagination: result.pagination
    });
  }, {
    parseJsonBody: false
  });
}

export async function POST(request: NextRequest) {
  return withResellerAuth<unknown>(request, async ({ auth, body }) => {
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return resellerError(400, "INVALID_REQUEST", "Invalid order payload.", {
        issues: parsed.error.issues
      });
    }

    try {
      const created = await createResellerOrder({
        agent: {
          id: auth.agentId,
          username: auth.agentUsername
        },
        credentialId: auth.credentialId,
        serviceId: parsed.data.service_id,
        phone: parsed.data.phone,
        qty: parsed.data.qty,
        clientOrderId: parsed.data.client_order_id
      });

      return resellerOk(
        {
          ...created.order,
          idempotent: created.idempotent
        },
        created.idempotent ? 200 : 201
      );
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === "INSUFFICIENT_BALANCE") {
        return resellerError(
          400,
          "INSUFFICIENT_BALANCE",
          "Wallet balance is too low for this order."
        );
      }
      if (code === "SERVICE_NOT_FOUND") {
        return resellerError(404, "NOT_FOUND", "Service not found or inactive.");
      }
      if (code === "INVALID_QTY" || code === "INVALID_PHONE" || code === "INVALID_REQUEST") {
        return resellerError(400, "INVALID_REQUEST", error instanceof Error ? error.message : "Invalid request.");
      }
      if (code === "P2002") {
        return resellerError(409, "CONFLICT", "Duplicate client_order_id detected.");
      }
      throw error;
    }
  });
}
