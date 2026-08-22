import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true, database: "connected" },
      { headers: { "X-LiteSpeed-Purge": "/" } }
    );
  } catch (error) {
    const err = error as unknown as {
      name?: string;
      message?: string;
      code?: string;
      errno?: string | number;
      syscall?: string;
      address?: string;
      port?: number;
      clientVersion?: string;
      cause?: unknown;
    };
    const msg = err?.message ?? "Unknown error";
    const cause =
      err?.cause && typeof err.cause === "object"
        ? (err.cause as Record<string, unknown>)
        : err?.cause;
    console.error("[Health] DB check failed:", error);
    return NextResponse.json(
      {
        ok: false,
        database: "disconnected",
        error: msg,
        meta: {
          name: err?.name,
          code: err?.code,
          errno: err?.errno,
          syscall: err?.syscall,
          address: err?.address,
          port: err?.port,
          clientVersion: err?.clientVersion,
          cause
        }
      },
      { status: 503, headers: { "X-LiteSpeed-Purge": "/" } }
    );
  }
}
