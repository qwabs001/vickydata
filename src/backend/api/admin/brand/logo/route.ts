import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";

const SETTINGS_KEY = "brand.logo";

const logoSchema = z.object({
  logoUrl: z.string().min(1)
});

/** Resolve image-host page URLs (e.g. ibb.co) to the direct image URL. */
async function resolveToDirectImageUrl(pageUrl: string): Promise<string | null> {
  try {
    const u = new URL(pageUrl);
    const host = u.hostname.toLowerCase();
    // Only resolve known page URLs; skip already-direct CDN hosts (e.g. i.ibb.co)
    if (host !== "ibb.co" && host !== "imgbb.com") return null;
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BundleArena/1.0)" },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const direct = ogImageMatch?.[1]?.trim();
    if (direct && (direct.startsWith("http://") || direct.startsWith("https://"))) return direct;
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }
    const setting = await prisma.settings.findUnique({ where: { key: SETTINGS_KEY } });
    const value = setting?.value as { logoUrl?: string } | null;
    return NextResponse.json({ logoUrl: value?.logoUrl ?? null });
  } catch (error) {
    console.error("Brand logo admin fetch error:", error);
    return NextResponse.json({ error: "Unable to load brand logo." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();
    const parsed = logoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid logo payload." }, { status: 400 });
    }

    let logoUrl = parsed.data.logoUrl.trim();
    const resolved = await resolveToDirectImageUrl(logoUrl);
    if (resolved) logoUrl = resolved;

    const userId = request.headers.get("x-user-id") ?? undefined;
    const value = { logoUrl };

    await prisma.settings.upsert({
      where: { key: SETTINGS_KEY },
      update: {
        value: value as any,
        category: "brand",
        updatedBy: userId
      },
      create: {
        key: SETTINGS_KEY,
        value: value as any,
        category: "brand",
        updatedBy: userId
      }
    });

    return NextResponse.json(value);
  } catch (error) {
    console.error("Brand logo admin save error:", error);
    return NextResponse.json({ error: "Unable to save brand logo." }, { status: 500 });
  }
}
