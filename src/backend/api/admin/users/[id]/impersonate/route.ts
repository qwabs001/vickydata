import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { getRequestIp, recordActivity } from "@/backend/lib/activityLog";

function getRoleDefaultRoute(role: "CUSTOMER" | "AGENT" | "ADMIN"): string {
  if (role === "AGENT") return "/agent";
  if (role === "ADMIN") return "/admin";
  return "/dashboard";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const adminId = request.headers.get("x-user-id");
    const { id } = await context.params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        phoneNumber: true,
        role: true,
        status: true
      }
    });

    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (target.role === "ADMIN") {
      return NextResponse.json({ error: "Cannot impersonate another admin." }, { status: 400 });
    }

    if (target.status !== "ACTIVE") {
      return NextResponse.json({ error: "Only active users can be impersonated." }, { status: 400 });
    }

    await recordActivity({
      userId: adminId,
      action: "Impersonated user",
      resource: target.username ?? target.phoneNumber ?? target.id,
      category: "Security",
      details: {
        targetUserId: target.id,
        targetRole: target.role
      },
      ipAddress: getRequestIp(request)
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: target.id,
        username: target.username,
        phoneNumber: target.phoneNumber,
        role: target.role
      },
      redirectTo: getRoleDefaultRoute(target.role)
    });
  } catch (error) {
    console.error("Admin impersonation error:", error);
    return NextResponse.json({ error: "Unable to impersonate user." }, { status: 500 });
  }
}
