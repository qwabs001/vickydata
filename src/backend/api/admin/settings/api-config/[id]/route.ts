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

const updateSchema = z.object({
  provider: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  apiSecret: z.string().optional(),
  baseUrl: z.string().url().optional(),
  endpoints: endpointsSchema,
  isActive: z.boolean().optional()
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const config = await prisma.apiConfiguration.findUnique({
      where: { id }
    });
    if (!config) {
      return NextResponse.json({ error: "API config not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: config.id,
      provider: config.provider,
      name: config.name,
      apiKey: config.apiKey,
      apiSecret: config.apiSecret ?? "",
      baseUrl: config.baseUrl,
      endpoints: config.endpoints ?? {},
      isActive: config.isActive
    });
  } catch (error) {
    console.error("API config get error:", error);
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Unable to load API config." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 }
      );
    }

    const existing = await prisma.apiConfiguration.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "API config not found." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.provider != null) updateData.provider = parsed.data.provider;
    if (parsed.data.name != null) updateData.name = parsed.data.name;
    if (parsed.data.apiKey != null) updateData.apiKey = parsed.data.apiKey;
    if (parsed.data.apiSecret !== undefined) {
      updateData.apiSecret = parsed.data.apiSecret.trim() || null;
    }
    if (parsed.data.baseUrl != null) updateData.baseUrl = parsed.data.baseUrl.replace(/\/+$/, "");
    if (parsed.data.endpoints !== undefined) updateData.endpoints = parsed.data.endpoints ?? {};
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

    const config = await prisma.apiConfiguration.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({
      id: config.id,
      provider: config.provider,
      name: config.name,
      baseUrl: config.baseUrl,
      hasApiKey: Boolean(config.apiKey),
      hasApiSecret: Boolean(config.apiSecret),
      endpoints: config.endpoints,
      isActive: config.isActive
    });
  } catch (error) {
    console.error("API config update error:", error);
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Unable to update API config." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    await prisma.apiConfiguration.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("API config delete error:", error);
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Unable to delete API config." }, { status: 500 });
  }
}
