import { NextRequest } from "next/server";
import { withResellerAuth } from "@/backend/api/v1/_lib/handler";
import { resellerError, resellerOk } from "@/backend/services/reseller/response";
import { cancelExternalOrder } from "@/backend/services/reseller/orders";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;

  return withResellerAuth(request, async ({ auth }) => {
    try {
      const order = await cancelExternalOrder(auth.agentId, orderId);
      if (!order) {
        return resellerError(404, "NOT_FOUND", "Order not found.");
      }

      return resellerOk(order);
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === "CANNOT_CANCEL") {
        return resellerError(409, "CONFLICT", "Order cannot be canceled once processing has started.");
      }
      throw error;
    }
  }, {
    parseJsonBody: false
  });
}
