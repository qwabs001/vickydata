import { NextResponse } from "next/server";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { dataProviderService } from "@/backend/services/dataProvider/dataProviderService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;

    const result = await dataProviderService.fulfillOrder(id);

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        reference: result.reference
      });
    }

    return NextResponse.json(
      { error: result.error ?? "Fulfillment failed." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Order fulfill error:", error);
    return NextResponse.json(
      { error: "Unable to fulfill order." },
      { status: 500 }
    );
  }
}
