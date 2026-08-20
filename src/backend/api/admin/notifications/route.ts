import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { withNotificationStorageRecovery } from "@/backend/lib/db/notificationStorage";
import { requireAdmin } from "@/backend/lib/middleware/admin";

const createSchema = z.object({
  type: z.enum(["POPUP", "BELL"]),
  title: z.string().min(1),
  content: z.string().min(1),
  isActive: z.boolean().optional()
});

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const notifications = await withNotificationStorageRecovery(() =>
      prisma.notification.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { reads: true } } }
      })
    );

    return NextResponse.json(
      notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        isActive: n.isActive,
        readCount: n._count.reads,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString()
      }))
    );
  } catch (error) {
    console.error("Notifications list error:", error);
    return NextResponse.json({ error: "Unable to load notifications." }, { status: 500 });
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

    const userId = request.headers.get("x-user-id");

    const notification = await withNotificationStorageRecovery(() =>
      prisma.notification.create({
        data: {
          type: parsed.data.type,
          title: parsed.data.title,
          content: parsed.data.content,
          isActive: parsed.data.isActive ?? true,
          createdBy: userId
        },
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          isActive: true,
          createdAt: true
        }
      })
    );

    return NextResponse.json({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      isActive: notification.isActive,
      createdAt: notification.createdAt.toISOString()
    });
  } catch (error) {
    console.error("Notification create error:", error);
    return NextResponse.json({ error: "Unable to create notification." }, { status: 500 });
  }
}
