import { NextRequest } from "next/server";
import { withResellerAuth } from "@/backend/api/v1/_lib/handler";
import { resellerOk } from "@/backend/services/reseller/response";
import { listResellerServices } from "@/backend/services/reseller/orders";

export async function GET(request: NextRequest) {
  return withResellerAuth(request, async ({ auth }) => {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") ?? 50)));
    const network = searchParams.get("network");

    const result = await listResellerServices(auth.agentId, {
      network,
      page,
      limit
    });

    return resellerOk({
      services: result.data,
      pagination: result.pagination
    });
  }, {
    parseJsonBody: false
  });
}
