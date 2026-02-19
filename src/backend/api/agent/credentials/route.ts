import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { decryptSecret } from "@/backend/services/reseller/crypto";

export async function GET(request: Request) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, username: true, status: true }
    });
    if (!user || (user.role !== "AGENT" && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const credentials = await prisma.agentApiCredential.findMany({
      where: { agentId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        apiSecretEnc: true,
        apiKey: true,
        name: true,
        status: true,
        rateLimitPerMin: true,
        lastUsedAt: true,
        lastRequestAt: true,
        requestCount: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      credentials: credentials.map((credential) => {
        let apiSecret = "";
        try {
          apiSecret = decryptSecret(credential.apiSecretEnc);
        } catch {
          apiSecret = "";
        }

        return {
          id: credential.id,
          name: credential.name,
          apiKey: credential.apiKey,
          apiSecret,
          status: credential.status,
          rateLimitPerMin: credential.rateLimitPerMin,
          lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
          lastRequestAt: credential.lastRequestAt?.toISOString() ?? null,
          requestCount: credential.requestCount,
          createdAt: credential.createdAt.toISOString()
        };
      })
    });
  } catch (error) {
    console.error("Agent credential read error:", error);
    return NextResponse.json({ error: "Unable to load API credentials." }, { status: 500 });
  }
}
