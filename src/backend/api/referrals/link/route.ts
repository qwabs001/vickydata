import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";

export async function GET(request: Request) {
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

  const rawOrigin =
    process.env.NEXT_PUBLIC_APP_URL ??
    request.headers.get("origin") ??
    "https://keldatagh.com";
  const origin = rawOrigin.includes("localhost") ? (process.env.NEXT_PUBLIC_APP_URL ?? "https://keldatagh.com") : rawOrigin;

  const normalizedOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  const link = `${normalizedOrigin}/?ref=${user.referralCode}`;

  return NextResponse.json({ code: user.referralCode, link });
}
