import { NextRequest } from "next/server";
import { withResellerAuth } from "@/backend/api/v1/_lib/handler";
import { resellerOk } from "@/backend/services/reseller/response";
import { getAgentWalletBalance } from "@/backend/services/reseller/orders";

export async function GET(request: NextRequest) {
  return withResellerAuth(request, async ({ auth }) => {
    const balance = await getAgentWalletBalance(auth.agentId);
    return resellerOk(balance);
  }, {
    parseJsonBody: false
  });
}
