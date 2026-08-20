import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { isDatabaseConnectionError } from "@/backend/lib/utils/dbError";

const ROLE_CACHE_TTL_MS = 60_000;
const roleCache = new Map<string, { role: string; expiresAt: number }>();

export async function requireAdmin(request: Request) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const cached = roleCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.role === "ADMIN") return { ok: true } as const;
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role) {
      roleCache.set(userId, { role: user.role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
    } else {
      roleCache.delete(userId);
    }

    if (!user || user.role !== "ADMIN") {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
      };
    }

    return { ok: true } as const;
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Database temporarily unavailable. Please try again in a moment." },
          { status: 503 }
        )
      };
    }
    throw error;
  }
}
