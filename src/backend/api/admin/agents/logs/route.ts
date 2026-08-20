import { NextResponse } from "next/server";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { prisma } from "@/backend/lib/db/prisma";

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId") ?? undefined;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") ?? 50)));

    const where = {
      ...(agentId ? { agentId } : {})
    };

    const [rows, total] = await Promise.all([
      prisma.agentApiRequestLog.findMany({
        where,
        include: {
          credential: {
            select: {
              apiKey: true,
              name: true
            }
          },
          agent: {
            select: {
              username: true,
              phoneNumber: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.agentApiRequestLog.count({ where })
    ]);

    return NextResponse.json({
      logs: rows.map((row) => ({
        id: row.id,
        agentId: row.agentId,
        agentName: row.agent.username ?? row.agent.phoneNumber,
        apiKey: row.credential?.apiKey ?? null,
        credentialName: row.credential?.name ?? null,
        method: row.method,
        path: row.path,
        statusCode: row.statusCode,
        durationMs: row.durationMs,
        ipAddress: row.ipAddress,
        errorCode: row.errorCode,
        createdAt: row.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total
      }
    });
  } catch (error) {
    console.error("Admin agent logs error:", error);
    return NextResponse.json({ error: "Unable to load agent API logs." }, { status: 500 });
  }
}
