import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { getRequestIp, recordActivity } from "@/backend/lib/activityLog";

const bodySchema = z.object({
  action: z.enum(["credit", "debit"]),
  amount: z.number().positive(),
  reason: z.string().max(200).optional()
});

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export async function POST(
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
    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid wallet adjustment." }, { status: 400 });
    }

    const { action, amount, reason } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, phoneNumber: true }
    });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const delta = action === "credit" ? amount : -amount;
    let nextBalance = 0;
    let nextAdded = 0;
    let nextSpent = 0;

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.walletBalance.findUnique({ where: { userId: id } });
      const before = wallet?.currentBalance ?? 0;
      const after = roundMoney(before + delta);
      if (after < 0) {
        throw new Error("Insufficient wallet balance for debit.");
      }

      nextBalance = after;
      nextAdded = roundMoney((wallet?.totalAdded ?? 0) + (action === "credit" ? amount : 0));
      nextSpent = roundMoney((wallet?.totalSpent ?? 0) + (action === "debit" ? amount : 0));

      await tx.walletBalance.upsert({
        where: { userId: id },
        create: {
          userId: id,
          totalAdded: action === "credit" ? amount : 0,
          totalSpent: action === "debit" ? amount : 0,
          currentBalance: after
        },
        update: {
          ...(action === "credit" ? { totalAdded: { increment: amount } } : {}),
          ...(action === "debit" ? { totalSpent: { increment: amount } } : {}),
          currentBalance: after
        }
      });

      await tx.walletTransaction.create({
        data: {
          userId: id,
          type: action === "credit" ? "ADDED" : "SPENT",
          amount,
          balanceBefore: before,
          balanceAfter: after,
          description: `${action === "credit" ? "Admin credit" : "Admin debit"}${reason ? `: ${reason}` : ""}`
        }
      });
    });

    await recordActivity({
      userId: adminId,
      action: action === "credit" ? "Credited wallet" : "Debited wallet",
      resource: user.username ?? user.phoneNumber ?? id,
      category: "Wallet",
      details: { amount, reason: reason ?? null },
      ipAddress: getRequestIp(request)
    });

    if (action === "credit" && nextBalance > 0) {
      try {
        const { sendWalletTopUpSms } = await import("@/backend/services/smsNotifications");
        await sendWalletTopUpSms(id, amount, nextBalance);
      } catch (smsErr) {
        console.error("[Admin] Wallet credit SMS error:", smsErr);
      }
    }

    return NextResponse.json({
      ok: true,
      walletBalance: nextBalance,
      walletAdded: nextAdded,
      walletSpent: nextSpent
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update wallet.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
