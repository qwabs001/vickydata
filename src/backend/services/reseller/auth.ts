import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { generateRequestId, decryptSecret } from "@/backend/services/reseller/crypto";
import { verifyRequestSignature } from "@/backend/services/reseller/signing";
import { resellerError } from "@/backend/services/reseller/response";

const MAX_TIMESTAMP_DRIFT_SECONDS = 300;
const NONCE_TTL_MINUTES = 10;

export type ResellerAuthContext = {
  requestId: string;
  agentId: string;
  agentUsername: string;
  credentialId: string;
  apiKey: string;
  rateLimitPerMin: number;
  ipAddress: string | null;
  pathWithQuery: string;
  rawBody: string;
  timestamp: number;
  nonce: string;
};

type AuthSuccess = { ok: true; context: ResellerAuthContext };
type AuthFailure = {
  ok: false;
  response: Response;
  agentId?: string;
  credentialId?: string;
  requestId: string;
  errorCode: string;
};

export type ResellerAuthResult = AuthSuccess | AuthFailure;

function getIpAddress(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")?.[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || null;
}

function parseAllowlist(raw: Prisma.JsonValue | null | undefined): string[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function isHttpsRequest(request: NextRequest): boolean {
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  if (protocol === "https") return true;
  const host = request.headers.get("host") ?? "";
  if (host.includes("localhost") || host.includes("127.0.0.1")) return true;
  return process.env.NODE_ENV !== "production";
}

function isRecentTimestamp(timestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - timestamp) <= MAX_TIMESTAMP_DRIFT_SECONDS;
}

async function isRateLimited(credentialId: string, limit: number): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 1000);
  const count = await prisma.agentApiRequestLog.count({
    where: {
      credentialId,
      createdAt: { gte: since }
    }
  });
  return count >= limit;
}

export async function authenticateResellerRequest(
  request: NextRequest,
  rawBody = ""
): Promise<ResellerAuthResult> {
  const requestId = request.headers.get("x-request-id") ?? generateRequestId();

  if (!isHttpsRequest(request)) {
    return {
      ok: false,
      requestId,
      errorCode: "FORBIDDEN",
      response: resellerError(403, "FORBIDDEN", "HTTPS is required for reseller API requests.")
    };
  }

  // Simple auth: X-API-KEY or Authorization: Bearer <key> only (no signing, no IP check)
  const apiKey =
    request.headers.get("x-api-key")?.trim() ??
    (() => {
      const auth = request.headers.get("authorization")?.trim();
      if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
      return undefined;
    })();
  const signature = request.headers.get("x-signature")?.trim();
  const timestampRaw = request.headers.get("x-timestamp")?.trim();
  const nonce = request.headers.get("x-nonce")?.trim();

  const useSimpleAuth = !signature || !timestampRaw || !nonce;
  if (!apiKey) {
    return {
      ok: false,
      requestId,
      errorCode: "UNAUTHORIZED",
      response: resellerError(401, "UNAUTHORIZED", "Missing API key. Send X-API-KEY or Authorization: Bearer <key>.")
    };
  }

  if (!useSimpleAuth) {
    const timestamp = Number(timestampRaw);
    if (!Number.isFinite(timestamp) || !isRecentTimestamp(timestamp)) {
      return {
        ok: false,
        requestId,
        errorCode: "INVALID_TIMESTAMP",
        response: resellerError(401, "INVALID_TIMESTAMP", "Timestamp is invalid or expired.", {
          max_drift_seconds: MAX_TIMESTAMP_DRIFT_SECONDS
        })
      };
    }
  }

  const credential = await prisma.agentApiCredential.findUnique({
    where: { apiKey },
    include: {
      agent: {
        select: {
          id: true,
          username: true,
          role: true,
          status: true
        }
      }
    }
  });

  if (!credential || credential.status !== "ACTIVE") {
    return {
      ok: false,
      requestId,
      errorCode: "UNAUTHORIZED",
      response: resellerError(401, "UNAUTHORIZED", "Invalid API credentials.")
    };
  }

  if (credential.agent.role !== "AGENT" || credential.agent.status !== "ACTIVE") {
    return {
      ok: false,
      requestId,
      credentialId: credential.id,
      agentId: credential.agent.id,
      errorCode: "FORBIDDEN",
      response: resellerError(403, "FORBIDDEN", "Agent account is not active.")
    };
  }

  const ipAddress = getIpAddress(request);
  const allowlist = parseAllowlist(credential.ipAllowlist);
  // Simple auth: no IP allowlist check (works from any IP, e.g. third-party platforms)
  if (!useSimpleAuth && allowlist.length > 0 && (!ipAddress || !allowlist.includes(ipAddress))) {
    return {
      ok: false,
      requestId,
      credentialId: credential.id,
      agentId: credential.agent.id,
      errorCode: "FORBIDDEN",
      response: resellerError(403, "FORBIDDEN", "IP address is not allowlisted for this API key.")
    };
  }

  if (await isRateLimited(credential.id, credential.rateLimitPerMin)) {
    return {
      ok: false,
      requestId,
      credentialId: credential.id,
      agentId: credential.agent.id,
      errorCode: "RATE_LIMIT_EXCEEDED",
      response: resellerError(
        429,
        "RATE_LIMIT_EXCEEDED",
        "Rate limit exceeded. Try again shortly.",
        { limit_per_minute: credential.rateLimitPerMin },
        { "Retry-After": "60" }
      )
    };
  }

  const url = new URL(request.url);
  const pathWithQuery = `${url.pathname}${url.search}`;

  if (!useSimpleAuth) {
    let secret = "";
    try {
      secret = decryptSecret(credential.apiSecretEnc);
    } catch {
      return {
        ok: false,
        requestId,
        credentialId: credential.id,
        agentId: credential.agent.id,
        errorCode: "UNAUTHORIZED",
        response: resellerError(401, "UNAUTHORIZED", "API secret configuration is invalid.")
      };
    }

    const validSignature = verifyRequestSignature(
      secret,
      {
        method: request.method,
        pathWithQuery,
        rawBody,
        timestamp: timestampRaw,
        nonce
      },
      signature!
    );
    if (!validSignature) {
      return {
        ok: false,
        requestId,
        credentialId: credential.id,
        agentId: credential.agent.id,
        errorCode: "INVALID_SIGNATURE",
        response: resellerError(401, "INVALID_SIGNATURE", "Request signature verification failed.")
      };
    }

    await prisma.agentApiNonce.deleteMany({
      where: {
        credentialId: credential.id,
        createdAt: {
          lt: new Date(Date.now() - NONCE_TTL_MINUTES * 60 * 1000)
        }
      }
    });

    try {
      await prisma.agentApiNonce.create({
        data: {
          agentId: credential.agent.id,
          credentialId: credential.id,
          nonce: nonce!
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return {
          ok: false,
          requestId,
          credentialId: credential.id,
          agentId: credential.agent.id,
          errorCode: "REPLAY_REQUEST",
          response: resellerError(401, "REPLAY_REQUEST", "Nonce has already been used.")
        };
      }
      throw error;
    }
  }

  await prisma.agentApiCredential.update({
    where: { id: credential.id },
    data: {
      lastUsedAt: new Date(),
      lastRequestAt: new Date(),
      requestCount: { increment: 1 }
    }
  });

  return {
    ok: true,
    context: {
      requestId,
      agentId: credential.agent.id,
      agentUsername: credential.agent.username,
      credentialId: credential.id,
      apiKey: credential.apiKey,
      rateLimitPerMin: credential.rateLimitPerMin,
      ipAddress,
      pathWithQuery,
      rawBody,
      timestamp: useSimpleAuth ? 0 : Number(timestampRaw),
      nonce: useSimpleAuth ? "" : nonce!
    }
  };
}

export async function logResellerRequest(input: {
  agentId?: string;
  credentialId?: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs?: number;
  ipAddress?: string | null;
  errorCode?: string;
  details?: Prisma.InputJsonValue;
}): Promise<void> {
  if (!input.agentId) return;
  try {
    await prisma.agentApiRequestLog.create({
      data: {
        agentId: input.agentId,
        credentialId: input.credentialId,
        requestId: input.requestId,
        method: input.method,
        path: input.path,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
        ipAddress: input.ipAddress ?? undefined,
        errorCode: input.errorCode,
        details: input.details
      }
    });
  } catch (error) {
    console.error("Failed to log reseller request:", error);
  }
}
