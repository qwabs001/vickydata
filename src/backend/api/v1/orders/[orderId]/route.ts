import { NextRequest } from "next/server";
import { withResellerAuth } from "@/backend/api/v1/_lib/handler";
import { resellerError, resellerOk } from "@/backend/services/reseller/response";
import { getAgentExternalOrder } from "@/backend/services/reseller/orders";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;

  return withResellerAuth(request, async ({ auth }) => {
    const order = await getAgentExternalOrder(auth.agentId, orderId, true);
    if (!order) {
      return resellerError(404, "NOT_FOUND", "Order not found.");
    }

    return resellerOk(order);
  }, {
    parseJsonBody: false
  });
}
