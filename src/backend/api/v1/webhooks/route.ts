import { z } from "zod";
import { NextRequest } from "next/server";
import { withResellerAuth } from "@/backend/api/v1/_lib/handler";
import { resellerError, resellerOk } from "@/backend/services/reseller/response";
import { createWebhookSubscription, listWebhookSubscriptions } from "@/backend/services/reseller/webhooks";

const subscribeSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).optional(),
  secret: z.string().min(8).max(200).optional()
});

export async function GET(request: NextRequest) {
  return withResellerAuth(request, async ({ auth }) => {
    const subscriptions = await listWebhookSubscriptions(auth.agentId);
    return resellerOk({ webhooks: subscriptions });
  }, {
    parseJsonBody: false
  });
}

export async function POST(request: NextRequest) {
  return withResellerAuth<unknown>(request, async ({ auth, body }) => {
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return resellerError(400, "INVALID_REQUEST", "Invalid webhook payload.", {
        issues: parsed.error.issues
      });
    }

    try {
      const subscription = await createWebhookSubscription({
        agentId: auth.agentId,
        url: parsed.data.url,
        events: parsed.data.events,
        secret: parsed.data.secret
      });
      return resellerOk(subscription, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create webhook subscription.";
      return resellerError(400, "INVALID_REQUEST", message);
    }
  });
}
