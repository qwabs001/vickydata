import { NextResponse } from "next/server";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { dataProviderService } from "@/backend/services/dataProvider/dataProviderService";

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const configId = body?.configId;

    if (!configId || typeof configId !== "string") {
      return NextResponse.json(
        { ok: false, networks: [], error: "configId is required." },
        { status: 400 }
      );
    }

    const result = await dataProviderService.previewNetworks(configId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("API config preview error:", error);
    return NextResponse.json(
      { ok: false, networks: [], error: "Preview failed." },
      { status: 500 }
    );
  }
}
