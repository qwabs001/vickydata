import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { mergeLandingConfig } from "@/shared/utils/landingConfig";

const SETTINGS_KEY = "landing.config";

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }
    const setting = await prisma.settings.findUnique({ where: { key: SETTINGS_KEY } });
    const stored = setting?.value ?? null;
    return NextResponse.json(mergeLandingConfig(stored as any));
  } catch (error) {
    console.error("Landing config admin fetch error:", error);
    return NextResponse.json({ error: "Unable to load landing content." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();
    const merged = mergeLandingConfig(body);
    const userId = request.headers.get("x-user-id") ?? undefined;

    await prisma.settings.upsert({
      where: { key: SETTINGS_KEY },
      update: {
        value: merged as any,
        category: "landing",
        updatedBy: userId
      },
      create: {
        key: SETTINGS_KEY,
        value: merged as any,
        category: "landing",
        updatedBy: userId
      }
    });

    return NextResponse.json(merged);
  } catch (error) {
    console.error("Landing config save error:", error);
    return NextResponse.json({ error: "Unable to save landing content." }, { status: 500 });
  }
}
