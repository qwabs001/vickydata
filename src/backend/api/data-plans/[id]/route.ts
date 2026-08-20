import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { dataPlanService } from "@/backend/services/dataPlans/dataPlanService";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { getRequestIp, recordActivity } from "@/backend/lib/activityLog";

const updateSchema = z.object({
  networkId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  dataAmount: z.string().optional(),
  dataInMB: z.number().optional(),
  price: z.number().optional(),
  agentPrice: z.number().nonnegative().nullable().optional(),
  currency: z.string().optional(),
  validity: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().optional()
});

const mapDataPlanError = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { status: 503, message: "Database unavailable. Check the connection string." };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return { status: 409, message: "A data plan with that name already exists for this network." };
    }
    if (error.code === "P2025") {
      return { status: 404, message: "Data plan not found." };
    }
  }
  return null;
};

const parseDataInMb = (value: string) => {
  const match = value.match(/(\d+(?:\.\d+)?)\s*gb/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? Math.round(amount * 1024) : 0;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }
    const userId = request.headers.get("x-user-id");
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data plan payload." }, { status: 400 });
    }

    const payload = parsed.data;
    const updates: Record<string, unknown> = { ...payload };
    if (payload.dataAmount && payload.dataInMB === undefined) {
      updates.dataInMB = parseDataInMb(payload.dataAmount);
    }

    const plan = await dataPlanService.update(id, updates as any);
    await recordActivity({
      userId,
      action: "Updated data plan",
      resource: plan.name ?? id,
      category: "Settings",
      ipAddress: getRequestIp(request)
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Data plan update error:", error);
    const mapped = mapDataPlanError(error);
    if (mapped) {
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
    return NextResponse.json({ error: "Unable to update data plan." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }
    const userId = request.headers.get("x-user-id");
    const { id } = await context.params;
    const plan = await prisma.dataPlan.findUnique({
      where: { id },
      select: { id: true, _count: { select: { orders: true } } }
    });
    if (!plan) {
      return NextResponse.json({ error: "Data plan not found." }, { status: 404 });
    }
    if (plan._count.orders > 0) {
      return NextResponse.json(
        { error: "Cannot delete a data plan with orders. Remove related orders first." },
        { status: 409 }
      );
    }
    await dataPlanService.remove(id);
    await recordActivity({
      userId,
      action: "Deleted data plan",
      resource: plan.id ?? id,
      category: "Settings",
      ipAddress: getRequestIp(request)
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Data plan delete error:", error);
    const mapped = mapDataPlanError(error);
    if (mapped) {
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
    return NextResponse.json({ error: "Unable to delete data plan." }, { status: 500 });
  }
}
