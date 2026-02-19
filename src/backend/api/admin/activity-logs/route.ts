import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }

    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200
    });

    const userIds = Array.from(
      new Set(logs.map((log) => log.userId).filter(Boolean))
    ) as string[];

    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, phoneNumber: true }
        })
      : [];

    const userMap = new Map(users.map((user) => [user.id, user]));

    return NextResponse.json({
      logs: logs.map((log) => {
        const details = (log.details as Record<string, unknown> | null) ?? {};
        const category = (details.category as string | undefined) ?? "System";
        const user = log.userId ? userMap.get(log.userId) : null;
        return {
          id: log.id,
          user: user?.username ?? user?.phoneNumber ?? (log.userId ? "User" : "System"),
          action: log.action,
          resource: log.resource,
          category,
          time: log.createdAt.toISOString()
        };
      })
    });
  } catch (error) {
    console.error("Activity log list error:", error);
    return NextResponse.json({ error: "Unable to load activity logs." }, { status: 500 });
  }
}
