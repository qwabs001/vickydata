import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";

const SETTINGS_KEY = "brand.logo";

export async function GET() {
  try {
    const setting = await prisma.settings.findUnique({ where: { key: SETTINGS_KEY } });
    const value = setting?.value as { logoUrl?: string } | null;
    return NextResponse.json({ logoUrl: value?.logoUrl ?? null });
  } catch (error) {
    console.error("Brand logo fetch error:", error);
    return NextResponse.json({ logoUrl: null });
  }
}
