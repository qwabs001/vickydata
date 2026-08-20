import { NextResponse } from "next/server";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { sendSms } from "@/backend/services/smsService";

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!phone) {
      return NextResponse.json({ error: "Phone number required.", ok: false }, { status: 400 });
    }

    const result = await sendSms(phone, "VickyData SMS test: Your SMS is working!");
    return NextResponse.json({
      ok: result.ok,
      message: result.ok ? "SMS sent." : result.error
    });
  } catch (error) {
    console.error("SMS test error:", error);
    return NextResponse.json({ error: "Test failed.", ok: false }, { status: 500 });
  }
}
