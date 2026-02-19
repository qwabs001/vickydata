import { NextResponse } from "next/server";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { rotateAgentCredentialSecret } from "@/backend/services/reseller/credentials";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const rotated = await rotateAgentCredentialSecret(id);

    return NextResponse.json({
      ok: true,
      ...rotated
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to rotate credential.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
