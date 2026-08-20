import { NextResponse } from "next/server";
import { resetPasswordSchema } from "@/shared/schemas/auth.schema";
import { authService } from "@/backend/services/auth/authService";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid reset password payload.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const data = parsed.data;

    const result = await authService.resetPassword(
      data.username,
      data.phoneNumber,
      data.password
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[reset-password]", error);
    return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
  }
}
