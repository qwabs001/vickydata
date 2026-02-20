import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { comparePassword, hashPassword } from "@/backend/lib/utils/hash";
import { getRequestIp, recordActivity } from "@/backend/lib/activityLog";

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  email: z.string().email().optional().or(z.literal("")),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(6).max(120).optional()
});

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const adminId = request.headers.get("x-user-id");
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        username: true,
        phoneNumber: true,
        fullName: true,
        preferences: true,
        role: true
      }
    });

    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin account not found." }, { status: 404 });
    }

    const prefs = (admin.preferences as { adminEmail?: string } | null) ?? null;
    return NextResponse.json({
      id: admin.id,
      username: admin.username,
      phoneNumber: admin.phoneNumber,
      fullName: admin.fullName ?? "",
      email: prefs?.adminEmail ?? ""
    });
  } catch (error) {
    console.error("Admin profile GET error:", error);
    return NextResponse.json({ error: "Unable to load admin profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const adminId = request.headers.get("x-user-id");
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid profile payload." }, { status: 400 });
    }

    const { fullName, email, currentPassword, newPassword } = parsed.data;
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        role: true,
        password: true,
        preferences: true
      }
    });
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin account not found." }, { status: 404 });
    }

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required." }, { status: 400 });
      }
      const passwordOk = await comparePassword(currentPassword, admin.password);
      if (!passwordOk) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
      }
    }

    const existingPrefs = (admin.preferences as Record<string, unknown> | null) ?? {};
    const nextPrefs: Record<string, unknown> = { ...existingPrefs };
    if (email !== undefined) {
      if (email.trim()) nextPrefs.adminEmail = email.trim();
      else delete nextPrefs.adminEmail;
    }

    const updated = await prisma.user.update({
      where: { id: adminId },
      data: {
        fullName: fullName !== undefined ? fullName.trim() : undefined,
        preferences: email !== undefined ? (nextPrefs as object) : undefined,
        password: newPassword ? await hashPassword(newPassword) : undefined
      },
      select: {
        id: true,
        username: true,
        phoneNumber: true,
        fullName: true,
        preferences: true
      }
    });

    await recordActivity({
      userId: adminId,
      action: "Updated admin profile",
      resource: updated.username,
      category: "Settings",
      details: {
        fullNameUpdated: fullName !== undefined,
        emailUpdated: email !== undefined,
        passwordChanged: Boolean(newPassword)
      },
      ipAddress: getRequestIp(request)
    });

    const prefs = (updated.preferences as { adminEmail?: string } | null) ?? null;
    return NextResponse.json({
      ok: true,
      profile: {
        id: updated.id,
        username: updated.username,
        phoneNumber: updated.phoneNumber,
        fullName: updated.fullName ?? "",
        email: prefs?.adminEmail ?? ""
      }
    });
  } catch (error) {
    console.error("Admin profile PATCH error:", error);
    return NextResponse.json({ error: "Unable to update admin profile." }, { status: 500 });
  }
}
