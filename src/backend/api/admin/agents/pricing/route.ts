import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import {
  getAgentPricingSettings,
  saveAgentPricingSettings
} from "@/backend/services/agentPricingService";

const bodySchema = z.object({
  discountPercent: z.number().min(0).max(95)
});

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const settings = await getAgentPricingSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Agent pricing settings fetch error:", error);
    return NextResponse.json({ error: "Unable to load agent pricing settings." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid pricing payload." }, { status: 400 });
    }

    const userId = request.headers.get("x-user-id") ?? undefined;
    const settings = await saveAgentPricingSettings(
      { discountPercent: parsed.data.discountPercent },
      userId
    );

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Agent pricing settings save error:", error);
    return NextResponse.json({ error: "Unable to save agent pricing settings." }, { status: 500 });
  }
}
