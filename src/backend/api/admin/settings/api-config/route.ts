import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { isDatabaseConnectionError } from "@/backend/lib/utils/dbError";

const endpointsSchema = z.object({
  networks: z.string().optional(),
  plans: z.string().optional(),
  purchase: z.string().optional(),
  test: z.string().optional(),
  status: z.string().optional(),
  purchaseMethod: z.enum(["GET", "POST"]).optional()
}).optional();

const createSchema = z.object({
  provider: z.string().min(1),
  name: z.string().min(1),
  apiKey: z.string().min(1),
  apiSecret: z.string().optional(),
  baseUrl: z.string().min(1).transform((s) => s.trim()).refine(
    (s) => {
      try {
        const u = new URL(s);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Base URL must be a valid http(s) URL" }
  ),
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
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
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
        apiSecret: parsed.data.apiSecret?.trim() || null,
        baseUrl: parsed.data.baseUrl.replace(/\/+$/, ""),
        endpoints: (parsed.data.endpoints ?? {}) as object,
        networkId: null
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
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
    const msg = error instanceof Error ? error.message : "Unable to create API config.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
