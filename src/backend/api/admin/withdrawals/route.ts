import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }

    const requests = await prisma.withdrawalRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, username: true, phoneNumber: true }
        }
      }
    });

    return NextResponse.json({
      requests: requests.map((request) => ({
        id: request.id,
        referenceNumber: request.referenceNumber,
        user: request.user?.username ?? request.user?.phoneNumber ?? "Customer",
        amount: request.amount,
        method: request.method,
        status: request.status,
        createdAt: request.createdAt.toISOString()
      }))
    });
  } catch (error) {
    console.error("Withdrawal list error:", error);
    return NextResponse.json({ error: "Unable to load withdrawals." }, { status: 500 });
  }
}
