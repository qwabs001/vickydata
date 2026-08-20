import { NextResponse } from "next/server";
import { signupSchema } from "@/shared/schemas/auth.schema";
import { authService } from "@/backend/services/auth/authService";
import { isDatabaseConnectionError } from "@/backend/lib/utils/dbError";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid signup data.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const data = parsed.data;
    const result = await authService.createUser(
      data.username,
      data.phoneNumber,
      data.password,
      data.referralCode ?? null
    );

    if (!result.ok) {
      // Return 503 for database connection errors, 400 for validation errors
      const isConnectionError = result.reason.includes("temporarily unavailable");
      return NextResponse.json(
        { error: result.reason },
        { status: isConnectionError ? 503 : 400 }
      );
    }

    const user = result.user;
    return NextResponse.json({
      id: user.id,
      username: user.username,
      phoneNumber: user.phoneNumber,
      role: user.role
    });
  } catch (error) {
    console.error("Signup error:", error);
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Unable to create account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
