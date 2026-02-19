import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";

const endpointsSchema = z.object({
  networks: z.string().optional(),
  plans: z.string().optional(),
  purchase: z.string().optional(),
  test: z.string().optional(),
  status: z.string().optional()
}).optional();

const createSchema = z.object({
  provider: z.string().min(1),
  name: z.string().min(1),
  apiKey: z.string().min(1),
  apiSecret: z.string().optional(),
  baseUrl: z.string().url(),
  endpoints: endpointsSchema
});

const updateSchema = createSchema.partial();

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const configs = await prisma.apiConfiguration.findMany({
      orderBy: { provider: "asc" }
    });

    return NextResponse.json(
      configs.map((c) => ({
        id: c.id,
        provider: c.provider,
        name: c.name,
        baseUrl: c.baseUrl,
        hasApiKey: Boolean(c.apiKey),
        hasApiSecret: Boolean(c.apiSecret),
        endpoints: c.endpoints,
        isActive: c.isActive,
        networkId: c.networkId
      }))
    );
  } catch (error) {
    console.error("API config list error:", error);
    return NextResponse.json({ error: "Unable to load API configs." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 }
      );
    }

    const existing = await prisma.apiConfiguration.findUnique({
      where: { provider: parsed.data.provider }
    });
    if (existing) {
      return NextResponse.json(
        { error: `Provider "${parsed.data.provider}" already exists. Use PATCH to update.` },
        { status: 409 }
      );
    }

    const config = await prisma.apiConfiguration.create({
      data: {
        provider: parsed.data.provider,
        name: parsed.data.name,
        apiKey: parsed.data.apiKey,
        apiSecret: parsed.data.apiSecret ?? parsed.data.apiKey,
        baseUrl: parsed.data.baseUrl,
        endpoints: (parsed.data.endpoints ?? {}) as object
      }
    });

    return NextResponse.json({
      id: config.id,
      provider: config.provider,
      name: config.name,
      baseUrl: config.baseUrl,
      hasApiKey: true,
      hasApiSecret: Boolean(config.apiSecret),
      endpoints: config.endpoints,
      isActive: config.isActive
    });
  } catch (error) {
    console.error("API config create error:", error);
    return NextResponse.json({ error: "Unable to create API config." }, { status: 500 });
  }
}
