import { Prisma } from "@prisma/client";
import { prisma } from "@/backend/lib/db/prisma";
import { encryptSecret, generateApiKey, generateApiSecret, hashSecret } from "@/backend/services/reseller/crypto";

function parseIpAllowlist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    )
  );
}

export async function createAgentCredential(input: {
  agentId: string;
  name?: string | null;
  rateLimitPerMin?: number;
  ipAllowlist?: unknown;
}): Promise<{
  id: string;
  agent_id: string;
  api_key: string;
  api_secret: string;
  status: string;
  rate_limit_per_min: number;
  ip_allowlist: string[];
  created_at: string;
}> {
  const agent = await prisma.user.findUnique({
    where: { id: input.agentId },
    select: { id: true, role: true, status: true }
  });

  if (!agent || agent.role !== "AGENT") {
    throw new Error("Agent account not found.");
  }

  if (agent.status !== "ACTIVE") {
    throw new Error("Only active agent accounts can receive API credentials.");
  }

  const apiKey = generateApiKey();
  const apiSecret = generateApiSecret();
  const rateLimitPerMin = Math.max(1, Math.min(5000, Number(input.rateLimitPerMin ?? 60)));
  const ipAllowlist = parseIpAllowlist(input.ipAllowlist);

  const credential = await prisma.agentApiCredential.create({
    data: {
      agentId: input.agentId,
      name: input.name?.trim() || null,
      apiKey,
      apiSecretHash: hashSecret(apiSecret),
      apiSecretEnc: encryptSecret(apiSecret),
      rateLimitPerMin,
      ipAllowlist
    }
  });

  return {
    id: credential.id,
    agent_id: credential.agentId,
    api_key: credential.apiKey,
    api_secret: apiSecret,
    status: credential.status,
    rate_limit_per_min: credential.rateLimitPerMin,
    ip_allowlist: ipAllowlist,
    created_at: credential.createdAt.toISOString()
  };
}

export async function listAgentCredentials(filter?: {
  agentId?: string | null;
}): Promise<Array<{
  id: string;
  agent_id: string;
  agent_name: string;
  api_key: string;
  name: string | null;
  status: string;
  rate_limit_per_min: number;
  ip_allowlist: string[];
  last_used_at: string | null;
  last_request_at: string | null;
  request_count: number;
  created_at: string;
  updated_at: string;
}>> {
  const rows = await prisma.agentApiCredential.findMany({
    where: {
      ...(filter?.agentId ? { agentId: filter.agentId } : {})
    },
    include: {
      agent: {
        select: {
          username: true,
          phoneNumber: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row) => ({
    id: row.id,
    agent_id: row.agentId,
    agent_name: row.agent.username ?? row.agent.phoneNumber,
    api_key: row.apiKey,
    name: row.name,
    status: row.status,
    rate_limit_per_min: row.rateLimitPerMin,
    ip_allowlist: parseIpAllowlist(row.ipAllowlist),
    last_used_at: row.lastUsedAt?.toISOString() ?? null,
    last_request_at: row.lastRequestAt?.toISOString() ?? null,
    request_count: row.requestCount,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString()
  }));
}

export async function updateAgentCredential(
  id: string,
  updates: {
    name?: string | null;
    status?: "ACTIVE" | "DISABLED";
    rateLimitPerMin?: number;
    ipAllowlist?: unknown;
  }
): Promise<void> {
  const data: Prisma.AgentApiCredentialUpdateInput = {
    ...(updates.name !== undefined ? { name: updates.name?.trim() || null } : {}),
    ...(updates.status ? { status: updates.status } : {}),
    ...(updates.rateLimitPerMin !== undefined
      ? { rateLimitPerMin: Math.max(1, Math.min(5000, Number(updates.rateLimitPerMin))) }
      : {}),
    ...(updates.ipAllowlist !== undefined
      ? { ipAllowlist: parseIpAllowlist(updates.ipAllowlist) as unknown as Prisma.InputJsonValue }
      : {})
  };

  await prisma.agentApiCredential.update({
    where: { id },
    data
  });
}

export async function rotateAgentCredentialSecret(id: string): Promise<{
  api_secret: string;
}> {
  const newSecret = generateApiSecret();

  await prisma.agentApiCredential.update({
    where: { id },
    data: {
      apiSecretHash: hashSecret(newSecret),
      apiSecretEnc: encryptSecret(newSecret)
    }
  });

  return {
    api_secret: newSecret
  };
}

export async function deleteAgentCredential(id: string): Promise<void> {
  await prisma.agentApiCredential.delete({
    where: { id }
  });
}
