import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { createAgentCredential, listAgentCredentials } from "@/backend/services/reseller/credentials";

const createSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().max(120).optional(),
  rateLimitPerMin: z.number().int().min(1).max(5000).optional(),
  ipAllowlist: z.array(z.string()).optional()
});

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    const credentials = await listAgentCredentials({ agentId });
    return NextResponse.json({ credentials });
  } catch (error) {
    console.error("Admin agent credentials list error:", error);
    return NextResponse.json({ error: "Unable to load agent credentials." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credential payload." }, { status: 400 });
    }

    const credential = await createAgentCredential({
      agentId: parsed.data.agentId,
      name: parsed.data.name,
      rateLimitPerMin: parsed.data.rateLimitPerMin,
      ipAllowlist: parsed.data.ipAllowlist
    });

    return NextResponse.json({ credential }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create agent credential.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
