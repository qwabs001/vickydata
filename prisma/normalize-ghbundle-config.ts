import { PrismaClient, type Prisma } from "@prisma/client";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

const GH_PROVIDER = "ghbundle";
const GH_ENDPOINT_DEFAULTS = {
  test: "/balance",
  networks: "/services",
  plans: "/services",
  purchase: "/orders",
  status: "/orders/{reference}",
  purchaseMethod: "POST" as const
};

const LEGACY_ENDPOINTS = new Set([
  "/",
  "/normal-orders",
  "/api/networks",
  "/api/plans",
  "/api/purchase"
]);

type EndpointShape = {
  test?: string;
  networks?: string;
  plans?: string;
  purchase?: string;
  status?: string;
  purchaseMethod?: "GET" | "POST";
};

type ConfigUpdate = {
  id: string;
  from: {
    provider: string;
    name: string;
    baseUrl: string;
    apiSecretState: "empty" | "same_as_api_key" | "custom";
    endpoints: Prisma.JsonValue;
  };
  to: {
    provider?: string;
    name?: string;
    baseUrl?: string;
    apiSecret?: string | null;
    endpoints?: EndpointShape;
  };
};

function isGhBundleUrl(value: string): boolean {
  const url = value.toLowerCase();
  return url.includes("ghbundle.com") || url.includes("ghbundle-reseller-api-proxy");
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function normalizeEndpoint(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (LEGACY_ENDPOINTS.has(trimmed.toLowerCase())) return fallback;
  return trimmed;
}

function normalizeEndpoints(value: Prisma.JsonValue): EndpointShape {
  const src = (value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const purchaseMethod = src.purchaseMethod === "GET" || src.purchaseMethod === "POST"
    ? src.purchaseMethod
    : GH_ENDPOINT_DEFAULTS.purchaseMethod;

  return {
    test: normalizeEndpoint(src.test, GH_ENDPOINT_DEFAULTS.test),
    networks: normalizeEndpoint(src.networks, GH_ENDPOINT_DEFAULTS.networks),
    plans: normalizeEndpoint(src.plans, GH_ENDPOINT_DEFAULTS.plans),
    purchase: normalizeEndpoint(src.purchase, GH_ENDPOINT_DEFAULTS.purchase),
    status: normalizeEndpoint(src.status, GH_ENDPOINT_DEFAULTS.status),
    purchaseMethod
  };
}

function equalJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  const shouldApply = process.argv.includes("--apply");
  const configs = await prisma.apiConfiguration.findMany({
    orderBy: { createdAt: "asc" }
  });

  const ghCandidates = configs.filter((c) => isGhBundleUrl(c.baseUrl) || c.provider === GH_PROVIDER);
  if (ghCandidates.length === 0) {
    console.log("No GhBundle-like API configs found. Nothing to normalize.");
    return;
  }

  const existingGhProvider = configs.find((c) => c.provider === GH_PROVIDER);
  const updates: ConfigUpdate[] = [];

  for (const config of ghCandidates) {
    const normalizedBaseUrl = normalizeBaseUrl(config.baseUrl);
    const normalizedEndpoints = normalizeEndpoints(config.endpoints as Prisma.JsonValue);

    const apiSecretRaw = config.apiSecret?.trim() ?? "";
    const apiKeyRaw = config.apiKey.trim();
    const apiSecretState: "empty" | "same_as_api_key" | "custom" =
      apiSecretRaw.length === 0 ? "empty" : apiSecretRaw === apiKeyRaw ? "same_as_api_key" : "custom";
    const normalizedSecret = apiSecretState === "custom" ? apiSecretRaw : null;

    const next: ConfigUpdate["to"] = {};
    if (config.baseUrl !== normalizedBaseUrl) {
      next.baseUrl = normalizedBaseUrl;
    }
    if (!equalJson(config.endpoints, normalizedEndpoints)) {
      next.endpoints = normalizedEndpoints;
    }
    if ((config.apiSecret ?? null) !== normalizedSecret) {
      next.apiSecret = normalizedSecret;
    }

    if (config.name !== "GhBundle API") {
      next.name = "GhBundle API";
    }

    const canSetProvider =
      config.provider === GH_PROVIDER ||
      existingGhProvider == null ||
      existingGhProvider.id === config.id;
    if (canSetProvider && config.provider !== GH_PROVIDER) {
      next.provider = GH_PROVIDER;
    }

    if (Object.keys(next).length === 0) {
      continue;
    }

    updates.push({
      id: config.id,
      from: {
        provider: config.provider,
        name: config.name,
        baseUrl: config.baseUrl,
        apiSecretState,
        endpoints: config.endpoints as Prisma.JsonValue
      },
      to: next
    });
  }

  if (updates.length === 0) {
    console.log("All GhBundle-like configs are already normalized.");
    return;
  }

  console.log(`${shouldApply ? "Applying" : "Dry run"} GhBundle config normalization for ${updates.length} config(s):`);
  for (const update of updates) {
    console.log(`\n- Config ${update.id}`);
    console.log(`  from provider=${update.from.provider}, name=${update.from.name}, baseUrl=${update.from.baseUrl}`);
    console.log(`  from apiSecretState=${update.from.apiSecretState}`);
    console.log(`  from endpoints=${JSON.stringify(update.from.endpoints)}`);
    console.log(`  to=${JSON.stringify(update.to)}`);
  }

  if (!shouldApply) {
    console.log("\nNo changes written. Re-run with --apply to persist these updates.");
    return;
  }

  for (const update of updates) {
    await prisma.apiConfiguration.update({
      where: { id: update.id },
      data: update.to
    });
  }

  console.log(`\nDone. Updated ${updates.length} config(s).`);
}

main()
  .catch((error) => {
    console.error("Normalization failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
