import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";

const THEME_KEY = "brand.theme";
const DEFAULT_ACCENT = "#f6c500";
const DEFAULT_PRIMARY = "#2563eb";

const themeSchema = z.object({
  accent: z.string().min(1).optional(),
  primary: z.string().min(1).optional(),
  footer: z.object({
    copyright: z.string().optional(),
    showLogo: z.boolean().optional(),
    privacyUrl: z.string().optional(),
    termsUrl: z.string().optional(),
    contactUrl: z.string().optional()
  }).optional(),
  contact: z.object({
    whatsapp: z.string().optional(),
    telegram: z.string().optional(),
    messenger: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    customLabel: z.string().optional(),
    customUrl: z.string().optional(),
    showWidget: z.boolean().optional()
  }).optional()
});

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const setting = await prisma.settings.findUnique({ where: { key: THEME_KEY } });
    const value = setting?.value as Record<string, unknown> | null;

    return NextResponse.json({
      accent: (value?.accent as string) ?? DEFAULT_ACCENT,
      primary: (value?.primary as string) ?? DEFAULT_PRIMARY,
      footer: value?.footer ?? {},
      contact: value?.contact ?? {}
    });
  } catch (error) {
    console.error("Admin brand theme fetch error:", error);
    return NextResponse.json({ error: "Unable to load theme." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsed = themeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid theme payload." }, { status: 400 });
    }

    const userId = request.headers.get("x-user-id") ?? undefined;

    const existing = await prisma.settings.findUnique({ where: { key: THEME_KEY } });
    const current = (existing?.value as Record<string, unknown>) ?? {};

    // Deep merge contact settings so partial updates work
    const currentContact = (current.contact as Record<string, unknown>) ?? {};
    const newContact = parsed.data.contact
      ? { ...currentContact, ...parsed.data.contact }
      : currentContact;

    const value = {
      accent: parsed.data.accent ?? (current.accent as string) ?? DEFAULT_ACCENT,
      primary: parsed.data.primary ?? (current.primary as string) ?? DEFAULT_PRIMARY,
      footer: parsed.data.footer
        ? { ...((current.footer as Record<string, unknown>) ?? {}), ...parsed.data.footer }
        : current.footer ?? {},
      contact: newContact
    };

    await prisma.settings.upsert({
      where: { key: THEME_KEY },
      update: {
        value: value as object,
        category: "brand",
        updatedBy: userId
      },
      create: {
        key: THEME_KEY,
        value: value as object,
        category: "brand",
        updatedBy: userId
      }
    });

    return NextResponse.json(value);
  } catch (error) {
    console.error("Admin brand theme save error:", error);
    return NextResponse.json({ error: "Unable to save theme." }, { status: 500 });
  }
}
