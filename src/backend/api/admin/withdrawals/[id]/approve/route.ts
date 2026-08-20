import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { getRequestIp, recordActivity } from "@/backend/lib/activityLog";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await context.params;
    const adminId = request.headers.get("x-user-id") ?? undefined;

    const withdrawal = await prisma.withdrawalRequest.findUnique({
      where: { id }
    });
    if (!withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found." }, { status: 404 });
    }
    if (withdrawal.status !== "PENDING") {
      return NextResponse.json({ error: "Withdrawal is already processed." }, { status: 409 });
    }

    await prisma.withdrawalRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        processedBy: adminId,
        processedAt: new Date()
      }
    });

    await recordActivity({
      userId: adminId,
      action: "Approved withdrawal",
      resource: withdrawal.referenceNumber ?? withdrawal.id,
      category: "Payments",
      ipAddress: getRequestIp(request)
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Withdrawal approve error:", error);
    return NextResponse.json({ error: "Unable to approve withdrawal." }, { status: 500 });
  }
}
