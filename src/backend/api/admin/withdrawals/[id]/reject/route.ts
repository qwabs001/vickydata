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

    await prisma.$transaction(async (tx) => {
      await tx.withdrawalRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          processedBy: adminId,
          processedAt: new Date(),
          failedReason: "Rejected by admin"
        }
      });

      const balance = await tx.rewardsBalance.findUnique({
        where: { userId: withdrawal.userId }
      });

      const before = balance?.currentBalance ?? 0;
      const after = Math.round((before + withdrawal.amount) * 100) / 100;
      const totalWithdrawn = Math.max(0, (balance?.totalWithdrawn ?? 0) - withdrawal.amount);

      await tx.rewardsBalance.upsert({
        where: { userId: withdrawal.userId },
        create: {
          userId: withdrawal.userId,
          totalEarned: 0,
          totalSpent: 0,
          totalWithdrawn,
          currentBalance: after
        },
        update: {
          totalWithdrawn,
          currentBalance: after
        }
      });

      await tx.rewardsTransaction.create({
        data: {
          userId: withdrawal.userId,
          type: "ADJUSTED",
          amount: withdrawal.amount,
          balanceBefore: before,
          balanceAfter: after,
          description: "Withdrawal rejected - refund",
          referenceNumber: withdrawal.referenceNumber ?? `ADJ-${Date.now()}`
        }
      });
    });

    await recordActivity({
      userId: adminId,
      action: "Rejected withdrawal",
      resource: withdrawal.referenceNumber ?? withdrawal.id,
      category: "Payments",
      ipAddress: getRequestIp(request)
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Withdrawal reject error:", error);
    return NextResponse.json({ error: "Unable to reject withdrawal." }, { status: 500 });
  }
}
