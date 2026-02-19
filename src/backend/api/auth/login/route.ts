import { NextResponse } from "next/server";
import { loginSchema } from "@/shared/schemas/auth.schema";
import { authService } from "@/backend/services/auth/authService";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid credentials.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const data = parsed.data;
    let user = await authService.validateUser(data.username, data.password);
    if (!user) {
      user = await authService.ensureDevAdmin(data.username, data.password);
    }

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      phoneNumber: user.phoneNumber,
      role: user.role
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed." },
      { status: 500 }
    );
  }
}
