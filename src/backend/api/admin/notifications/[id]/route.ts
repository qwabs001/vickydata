import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { withNotificationStorageRecovery } from "@/backend/lib/db/notificationStorage";
import { requireAdmin } from "@/backend/lib/middleware/admin";

const updateSchema = z.object({
  type: z.enum(["POPUP", "BELL"]).optional(),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 }
      );
    }

    const existing = await withNotificationStorageRecovery(() =>
      prisma.notification.findUnique({ where: { id } })
    );
    if (!existing) {
      return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    }

    const notification = await withNotificationStorageRecovery(() =>
      prisma.notification.update({
        where: { id },
        data: parsed.data
      })
    );

    return NextResponse.json({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      isActive: notification.isActive,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString()
    });
  } catch (error) {
    console.error("Notification update error:", error);
    return NextResponse.json({ error: "Unable to update notification." }, { status: 500 });
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
    await withNotificationStorageRecovery(() =>
      prisma.notification.delete({ where: { id } })
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notification delete error:", error);
    return NextResponse.json({ error: "Unable to delete notification." }, { status: 500 });
  }
}
