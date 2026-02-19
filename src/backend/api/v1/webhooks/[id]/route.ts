import { NextRequest } from "next/server";
import { withResellerAuth } from "@/backend/api/v1/_lib/handler";
import { resellerError, resellerOk } from "@/backend/services/reseller/response";
import { deleteWebhookSubscription } from "@/backend/services/reseller/webhooks";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  return withResellerAuth(request, async ({ auth }) => {
    const removed = await deleteWebhookSubscription(auth.agentId, id);
    if (!removed) {
      return resellerError(404, "NOT_FOUND", "Webhook subscription not found.");
    }

    return resellerOk({ ok: true });
  }, {
    parseJsonBody: false
  });
}
