import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { resolveAppUrl } from "@/backend/lib/utils/appUrl";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Missing userId." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 400 });
    }

    // Use resolveAppUrl to ensure we always get the production URL, never localhost
    const baseUrl = resolveAppUrl(request);
    const link = `${baseUrl}/?ref=${user.referralCode}`;

    return NextResponse.json({ code: user.referralCode, link });
  } catch (error) {
    console.error("[Referral Link] Error:", error);
    return NextResponse.json({ error: "Unable to generate referral link." }, { status: 500 });
  }
}
