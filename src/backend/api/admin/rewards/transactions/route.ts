import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";

const statusForWithdrawal = (status?: string | null) => {
  switch (status) {
    case "APPROVED":
    case "COMPLETED":
      return "Completed";
    case "REJECTED":
    case "FAILED":
      return "Failed";
    default:
      return "Processing";
  }
};

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }

    const transactions = await prisma.rewardsTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 250,
      include: {
        user: {
          select: { id: true, username: true, phoneNumber: true }
        }
      }
    });

    const withdrawalRefs = transactions
      .filter((txn) => txn.type === "WITHDRAWN" && txn.referenceNumber)
      .map((txn) => txn.referenceNumber as string);

    const withdrawals = withdrawalRefs.length
      ? await prisma.withdrawalRequest.findMany({
          where: { referenceNumber: { in: withdrawalRefs } },
          select: { referenceNumber: true, status: true }
        })
      : [];

    const withdrawalMap = new Map(
      withdrawals.map((item) => [item.referenceNumber, item.status])
    );

    return NextResponse.json({
      transactions: transactions.map((txn) => {
        const userLabel = txn.user?.username ?? txn.user?.phoneNumber ?? "Customer";
        const withdrawalStatus =
          txn.type === "WITHDRAWN"
            ? statusForWithdrawal(withdrawalMap.get(txn.referenceNumber ?? ""))
            : "Completed";
        return {
          id: txn.id,
          date: txn.createdAt.toISOString(),
          type: txn.type,
          user: userLabel,
          amount: txn.amount,
          status: withdrawalStatus
        };
      })
    });
  } catch (error) {
    console.error("Rewards transactions admin error:", error);
    return NextResponse.json({ error: "Unable to load rewards transactions." }, { status: 500 });
  }
}
