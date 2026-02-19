import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { getRequestIp, recordActivity } from "@/backend/lib/activityLog";

const updateSchema = z.object({
  username: z.string().min(1).optional(),
  phoneNumber: z.string().min(6).optional(),
  role: z.enum(["CUSTOMER", "AGENT", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]).optional(),
  vip: z.boolean().optional()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }
    const adminId = request.headers.get("x-user-id");
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid user payload." }, { status: 400 });
    }

    const updates = parsed.data;
    let preferencesUpdate: Prisma.InputJsonValue | undefined;

    if (updates.vip !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id },
        select: { preferences: true }
      });
      const existing =
        (current?.preferences as Prisma.JsonObject | null) ?? {};
      preferencesUpdate = { ...existing, vip: updates.vip } as Prisma.InputJsonValue;
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        username: updates.username,
        phoneNumber: updates.phoneNumber,
        role: updates.role,
        status: updates.status,
        preferences: preferencesUpdate
      }
    });

    await recordActivity({
      userId: adminId,
      action: "Updated user",
      resource: user.username ?? user.phoneNumber ?? id,
      category: "Settings",
      ipAddress: getRequestIp(request)
    });

    return NextResponse.json({
      id: user.id,
      username: user.username,
      phoneNumber: user.phoneNumber,
      status: user.status,
      preferences: user.preferences
    });
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json({ error: "Unable to update user." }, { status: 500 });
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
    const adminId = request.headers.get("x-user-id");
    const { id } = await context.params;
    const user = await prisma.user.update({
      where: { id },
      data: { status: "DELETED" }
    });
    await recordActivity({
      userId: adminId,
      action: "Deleted user",
      resource: user.username ?? user.phoneNumber ?? id,
      category: "Settings",
      ipAddress: getRequestIp(request)
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("User delete error:", error);
    return NextResponse.json({ error: "Unable to delete user." }, { status: 500 });
  }
}
