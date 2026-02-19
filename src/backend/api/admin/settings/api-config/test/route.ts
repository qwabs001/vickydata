import { NextResponse } from "next/server";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { dataProviderService } from "@/backend/services/dataProvider/dataProviderService";

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const configId = body?.configId ?? undefined;

    const result = await dataProviderService.testConnection(configId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("API config test error:", error);
    return NextResponse.json(
      { ok: false, message: "Test failed." },
      { status: 500 }
    );
  }
}
