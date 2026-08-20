import { Prisma, type AgentExternalOrder, type Order } from "@prisma/client";
import { prisma } from "@/backend/lib/db/prisma";
import { decryptSecret, encryptSecret, generateApiSecret, hashSecret, signHmacSha256 } from "@/backend/services/reseller/crypto";
import { mapToResellerStatus } from "@/backend/services/reseller/format";
import type { SignedWebhookPayload, WebhookDeliveryEnvelope } from "@/backend/services/reseller/types";

const MAX_WEBHOOK_ATTEMPTS = 10;

function getBackoffMs(attempt: number): number {
  // 30s, 60s, 120s ... capped at 30min
  return Math.min(30 * 60 * 1000, 30 * 1000 * 2 ** Math.max(0, attempt - 1));
}

function sanitizeEvents(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ["order.updated"];
  const events = raw
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  if (events.length === 0) return ["order.updated"];
  return Array.from(new Set(events));
}

function validateWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function createWebhookSubscription(input: {
  agentId: string;
  url: string;
  events?: unknown;
  secret?: string | null;
}): Promise<{
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  created_at: string;
  secret?: string;
}> {
  if (!validateWebhookUrl(input.url)) {
    throw new Error("Webhook URL must be a valid HTTPS URL.");
  }

  const events = sanitizeEvents(input.events);
  const secretValue = input.secret?.trim() || generateApiSecret();

  const subscription = await prisma.agentWebhookSubscription.create({
    data: {
      agentId: input.agentId,
      url: input.url,
      events,
      enabled: true,
      secretHash: hashSecret(secretValue),
      secretEnc: encryptSecret(secretValue)
    }
  });

  return {
    id: subscription.id,
    url: subscription.url,
    events,
    enabled: subscription.enabled,
    created_at: subscription.createdAt.toISOString(),
    secret: input.secret ? undefined : secretValue
  };
}

export async function listWebhookSubscriptions(agentId: string): Promise<Array<{
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}>> {
  const rows = await prisma.agentWebhookSubscription.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    events: sanitizeEvents(row.events),
    enabled: row.enabled,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString()
  }));
}

export async function deleteWebhookSubscription(agentId: string, id: string): Promise<boolean> {
  const result = await prisma.agentWebhookSubscription.deleteMany({
    where: { id, agentId }
  });
  return result.count > 0;
}

export async function enqueueOrderUpdatedWebhook(input: {
  externalOrder: AgentExternalOrder;
  order: Pick<Order, "id" | "amount" | "currency" | "status" | "paymentStatus">;
}): Promise<void> {
  const subscriptions = await prisma.agentWebhookSubscription.findMany({
    where: {
      agentId: input.externalOrder.agentId,
      enabled: true
    }
  });

  if (subscriptions.length === 0) {
    await prisma.agentExternalOrder.update({
      where: { id: input.externalOrder.id },
      data: { lastKnownStatus: mapToResellerStatus(input.order.status, input.order.paymentStatus) }
    });
    return;
  }

  const status = mapToResellerStatus(input.order.status, input.order.paymentStatus);
  const payload: SignedWebhookPayload = {
    event: "order.updated",
    order_id: input.order.id,
    client_order_id: input.externalOrder.clientOrderId,
    status,
    amount: input.order.amount,
    currency: input.order.currency,
    timestamp: new Date().toISOString()
  };

  await prisma.$transaction(async (tx) => {
    for (const sub of subscriptions) {
      const events = sanitizeEvents(sub.events);
      if (!events.includes("order.updated")) continue;
      await tx.agentWebhookDelivery.create({
        data: {
          agentId: input.externalOrder.agentId,
          subscriptionId: sub.id,
          externalOrderId: input.externalOrder.id,
          event: "order.updated",
          payload: payload as unknown as Prisma.InputJsonValue,
          status: "PENDING"
        }
      });
    }

    await tx.agentExternalOrder.update({
      where: { id: input.externalOrder.id },
      data: { lastKnownStatus: status }
    });
  });
}

export async function processPendingWebhookDeliveries(limit = 25): Promise<void> {
  const deliveries = await prisma.agentWebhookDelivery.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }]
    },
    include: {
      subscription: true
    },
    take: Math.max(1, Math.min(100, limit)),
    orderBy: { createdAt: "asc" }
  });

  for (const delivery of deliveries) {
    const attempts = delivery.attempts + 1;
    try {
      const secret = decryptSecret(delivery.subscription.secretEnc);
      const payload = delivery.payload as SignedWebhookPayload;
      const rawPayload = JSON.stringify(payload);
      const signature = signHmacSha256(secret, rawPayload);
      const envelope: WebhookDeliveryEnvelope = {
        ...payload,
        signature
      };

      const response = await fetch(delivery.subscription.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": delivery.event,
          "X-Webhook-Id": delivery.id
        },
        body: JSON.stringify(envelope)
      });

      if (response.ok) {
        await prisma.agentWebhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "SENT",
            attempts,
            sentAt: new Date(),
            lastError: null,
            nextAttemptAt: null
          }
        });
        continue;
      }

      const responseBody = await response.text().catch(() => "");
      const message = `HTTP ${response.status}${responseBody ? `: ${responseBody.slice(0, 500)}` : ""}`;
      await updateWebhookRetry(delivery.id, attempts, message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown webhook error";
      await updateWebhookRetry(delivery.id, attempts, message);
    }
  }
}

async function updateWebhookRetry(deliveryId: string, attempts: number, message: string): Promise<void> {
  const nextAttemptAt = new Date(Date.now() + getBackoffMs(attempts));
  if (attempts >= MAX_WEBHOOK_ATTEMPTS) {
    await prisma.agentWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "DEAD_LETTER",
        attempts,
        lastError: message,
        nextAttemptAt: null
      }
    });
    return;
  }

  await prisma.agentWebhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "FAILED",
      attempts,
      lastError: message,
      nextAttemptAt
    }
  });
}
