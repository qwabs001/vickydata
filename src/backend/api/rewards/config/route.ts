import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    rewardPercentage: 1,
    isActive: true,
    minPurchaseAmount: 0,
    maxRewardPerOrder: null,
    minWithdrawalAmount: 5
  });
}

export async function PATCH() {
  return NextResponse.json({ ok: true });
}
