import { NextResponse } from "next/server";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { dataProviderService } from "@/backend/services/dataProvider/dataProviderService";

export async function POST(request: Request) {
  let configId: string | undefined;
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    configId = body?.configId ?? undefined;

    const result = await dataProviderService.testConnection(configId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("API config test error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("API config test error details:", { errorMessage, errorStack, configId });
    return NextResponse.json(
      { ok: false, message: `Test failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
