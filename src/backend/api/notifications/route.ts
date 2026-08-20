import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";

export async function GET(request: Request) {
  try {
    const userId = request.headers.get("x-user-id") ?? new URL(request.url).searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    // Get all active notifications
    const notifications = await prisma.notification.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: {
        reads: {
          where: { userId },
          select: { readAt: true }
        }
      }
    });

    const bell = notifications
      .filter((n) => n.type === "BELL")
      .map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        createdAt: n.createdAt.toISOString(),
        read: n.reads.length > 0
      }));

    const popups = notifications
      .filter((n) => n.type === "POPUP" && n.reads.length === 0)
      .map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        createdAt: n.createdAt.toISOString()
      }));

    const unreadCount = bell.filter((b) => !b.read).length;

    return NextResponse.json({ bell, popups, unreadCount });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    return NextResponse.json({ bell: [], popups: [], unreadCount: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = body.userId;
    const notificationId = body.notificationId;

    if (!userId || !notificationId) {
      return NextResponse.json({ error: "userId and notificationId required." }, { status: 400 });
    }

    // Mark as read (upsert to avoid duplicates)
    await prisma.notificationRead.upsert({
      where: {
        notificationId_userId: { notificationId, userId }
      },
      create: { notificationId, userId },
      update: { readAt: new Date() }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notification read error:", error);
    return NextResponse.json({ error: "Unable to mark as read." }, { status: 500 });
  }
}
