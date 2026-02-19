import { NextResponse } from "next/server";
import { resetPasswordSchema } from "@/shared/schemas/auth.schema";
import { authService } from "@/backend/services/auth/authService";

export async function POST(request: Request) {
  const body = await request.json();
  const data = resetPasswordSchema.parse(body);

  const result = await authService.resetPassword(
    data.username,
    data.phoneNumber,
    data.password
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
