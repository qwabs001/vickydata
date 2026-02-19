import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { deleteAgentCredential, updateAgentCredential } from "@/backend/services/reseller/credentials";

const updateSchema = z.object({
  name: z.string().max(120).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  rateLimitPerMin: z.number().int().min(1).max(5000).optional(),
  ipAllowlist: z.array(z.string()).optional()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credential update." }, { status: 400 });
    }

    await updateAgentCredential(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update credential.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    await deleteAgentCredential(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete credential.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
