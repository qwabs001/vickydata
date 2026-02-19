import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { mergeLandingConfig } from "@/shared/utils/landingConfig";

const SETTINGS_KEY = "landing.config";

export async function GET() {
  try {
    const setting = await prisma.settings.findUnique({ where: { key: SETTINGS_KEY } });
    const stored = setting?.value ?? null;
    return NextResponse.json(mergeLandingConfig(stored as any));
  } catch (error) {
    console.error("Landing config fetch error:", error);
    return NextResponse.json(mergeLandingConfig(null));
  }
}
