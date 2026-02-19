import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";

export async function requireAdmin(request: Request) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  if (!user || user.role !== "ADMIN") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return { ok: true } as const;
}
