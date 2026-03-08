import { prisma } from "@/backend/lib/db/prisma";
import { toLocalGhanaPhone } from "@/backend/lib/utils/phoneFormatter";
import { createHmac, randomBytes } from "crypto";
import type { ApiConfiguration } from "@prisma/client";

type EndpointsConfig = {
  networks?: string;
  plans?: string;
  purchase?: string;
  test?: string;
  status?: string;
  purchaseMethod?: "GET" | "POST"; // HTTP method for purchase endpoint
};

function parseApiKey(input?: string): { raw: string; token: string; authorization: string } {
  const raw = input?.trim() ?? "";
  if (!raw) {
    return { raw: "", token: "", authorization: "" };
  }

  const match = raw.match(/^(bearer|token|apikey|api-key|basic)\s+(.+)$/i);
  if (match) {
    return {
      raw,
      token: match[2].trim(),
      authorization: raw
    };
  }

  return {
    raw,
    token: raw,
    authorization: `Bearer ${raw}`
  };
}

function buildAuthHeaders(baseUrl: string, apiKey?: string, apiSecret?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const parsedKey = parseApiKey(apiKey);
  const isGhBundle = isGhBundleBaseUrl(baseUrl);
  if (parsedKey.raw) {
    headers.Authorization = parsedKey.authorization;
    headers["X-API-KEY"] = parsedKey.token;
    if (!isGhBundle) {
      headers["X-Auth-Token"] = parsedKey.token;
      headers["Api-Key"] = parsedKey.token;
    }
  }
  const secret = apiSecret?.trim() ?? "";
  if (!isGhBundle && secret && secret !== parsedKey.token) {
    headers["X-API-Secret"] = secret;
  }
  return headers;
}

function buildSignedHeaders(params: {
  baseUrl: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  apiKey?: string;
  apiSecret?: string;
}): Record<string, string> {
  if (isGhBundleBaseUrl(params.baseUrl)) return {};
  const parsedKey = parseApiKey(params.apiKey);
  const secret = params.apiSecret?.trim() ?? "";
  if (!secret || secret === parsedKey.token) return {};

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(12).toString("hex");
  const bodyString = params.body ? JSON.stringify(params.body) : "";
  const payload = [params.method.toUpperCase(), params.path, bodyString, timestamp, nonce].join("\n");
  const signature = createHmac("sha256", secret).update(payload).digest("hex");

  return {
    "X-TIMESTAMP": timestamp,
    "X-NONCE": nonce,
    "X-SIGNATURE": signature
  };
}

async function getActiveConfig(): Promise<ApiConfiguration | null> {
  const config = await prisma.apiConfiguration.findFirst({
    where: { isActive: true, networkId: null }
  });
  return config;
}

function getUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function getSignaturePath(baseUrl: string, path: string): string {
  try {
    const resolved = new URL(getUrl(baseUrl, path));
    return `${resolved.pathname}${resolved.search}`;
  } catch {
    return path;
  }
}

function isV1SizeVariantUnavailableMessage(value?: string | null): boolean {
  const lower = (value ?? "").toLowerCase();
  if (!lower) return false;
  return (
    lower.includes("size variant not available") ||
    (lower.includes("variant") && lower.includes("not available")) ||
    lower.includes("bundle size is unavailable")
  );
}

/** Parse provider API error into a clear, user-friendly failure reason. */
function parseProviderError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const errWithBody = err as { body?: string; status?: number };
  const body = typeof errWithBody?.body === "string" ? errWithBody.body : "";
  const status = errWithBody?.status;

  // Try to parse JSON error response
  type ParsedErrorShape = { message?: string; error?: string; msg?: string; code?: string };
  let parsed: ParsedErrorShape | null = null;
  if (body) {
    try {
      parsed = JSON.parse(body) as ParsedErrorShape;
    } catch {
      const jsonMatch = msg.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]) as ParsedErrorShape;
        } catch {
          /* ignore */
        }
      }
    }
  }

  const providerMsg = parsed?.message ?? parsed?.error ?? parsed?.msg ?? "";
  const lower = (providerMsg + msg + body).toLowerCase();

  if (lower.includes("insufficient") || lower.includes("balance") || lower.includes("low balance") || lower.includes("not enough")) {
    return "Provider account has insufficient balance. Please top up your provider account.";
  }
  if (lower.includes("invalid") && (lower.includes("phone") || lower.includes("number") || lower.includes("beneficiary"))) {
    return "Invalid recipient phone number. Please check and try again.";
  }
  if (lower.includes("network") && (lower.includes("unavailable") || lower.includes("down"))) {
    return "Provider network temporarily unavailable. Please try again later.";
  }
  if (status === 401 || status === 403 || lower.includes("unauthorized") || lower.includes("forbidden") || (lower.includes("auth") && (lower.includes("fail") || lower.includes("invalid") || lower.includes("error")))) {
    return "Provider API authentication failed. Check your API key, API secret, and base URL in Settings > API Configuration.";
  }
  if (isV1SizeVariantUnavailableMessage(providerMsg) || isV1SizeVariantUnavailableMessage(lower)) {
    return "Selected bundle size is unavailable on provider for this network. Use a plan size that exists in the provider catalog.";
  }
  if (status === 404 || lower.includes("not found")) {
    return "Plan or network not found on provider. Verify your plan catalog.";
  }

  return providerMsg.trim() || msg;
}

async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options: {
    method?: "GET" | "POST";
    apiKey?: string;
    apiSecret?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const url = getUrl(baseUrl, path);
  const signaturePath = getSignaturePath(baseUrl, path);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };
  Object.assign(headers, buildAuthHeaders(baseUrl, options.apiKey, options.apiSecret));
  Object.assign(
    headers,
    buildSignedHeaders({
      baseUrl,
      method: options.method ?? "GET",
      path: signaturePath,
      body: options.body,
      apiKey: options.apiKey,
      apiSecret: options.apiSecret
    })
  );

  // Log request details (without exposing sensitive values)
  const logHeaders = { ...headers };
  if (logHeaders.Authorization) logHeaders.Authorization = logHeaders.Authorization.substring(0, 20) + "...";
  if (logHeaders["X-API-Key"]) logHeaders["X-API-Key"] = logHeaders["X-API-Key"].substring(0, 10) + "...";
  console.log("[apiRequest] Request:", {
    method: options.method ?? "GET",
    url,
    hasApiKey: Boolean(options.apiKey),
    hasApiSecret: Boolean(options.apiSecret),
    headerKeys: Object.keys(headers)
  });

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!res.ok) {
    const text = await res.text();
    const contentType = res.headers.get("content-type") || "";
    const isHtml = contentType.includes("text/html") || text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<!doctype") || text.trim().startsWith("<html");
    
    console.error("[apiRequest] Provider API error:", {
      status: res.status,
      statusText: res.statusText,
      url,
      contentType,
      isHtml,
      headers: Object.fromEntries(res.headers.entries()),
      body: text.slice(0, 500)
    });
    
    // If we got HTML back, it's likely a 404 page or wrong endpoint
    if (isHtml && res.status === 404) {
      const err = new Error(`Endpoint not found (404). The API endpoint "${path}" does not exist on "${baseUrl}". Check your base URL and endpoint configuration.`) as Error & { status?: number; body?: string };
      err.status = res.status;
      err.body = text;
      throw err;
    }
    
    const err = new Error(`API error ${res.status}: ${text.slice(0, 500)}`) as Error & { status?: number; body?: string };
    err.status = res.status;
    err.body = text;
    throw err;
  }

  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return { ok: true } as T;
}

export type PreviewNetwork = {
  name: string;
  displayName: string;
  plans: Array<{ name: string; dataAmount: string; price: number; validity: string }>;
};

const V1_NETWORKS: Array<{ name: string; displayName: string; apiId: number }> = [
  { name: "MTN", displayName: "MTN", apiId: 9 },
  { name: "TELECEL", displayName: "Telecel", apiId: 10 },
  { name: "ISHARE", displayName: "iShare", apiId: 11 },
  { name: "BIGTIME", displayName: "BigTime", apiId: 12 }
];

type PlanDef = { name: string; dataAmount: string; price: number; validity: string };
type V1NetworkName = "MTN" | "TELECEL" | "ISHARE" | "BIGTIME";

/* ── Per-network plan catalogs ──
   Comprehensive plan lists for each DataFraternity network.
   Prices are base reseller costs (GHS). Admin can add markup via sync options. */
const V1_NETWORK_PLANS: Record<string, PlanDef[]> = {
  MTN: [
    { name: "1GB",  dataAmount: "1GB",  price: 4,    validity: "30 days" },
    { name: "2GB",  dataAmount: "2GB",  price: 8,    validity: "30 days" },
    { name: "3GB",  dataAmount: "3GB",  price: 10,   validity: "30 days" },
    { name: "4GB",  dataAmount: "4GB",  price: 14,   validity: "30 days" },
    { name: "5GB",  dataAmount: "5GB",  price: 18,   validity: "30 days" },
    { name: "6GB",  dataAmount: "6GB",  price: 22,   validity: "30 days" },
    { name: "7GB",  dataAmount: "7GB",  price: 25,   validity: "30 days" },
    { name: "8GB",  dataAmount: "8GB",  price: 28,   validity: "30 days" },
    { name: "10GB", dataAmount: "10GB", price: 35,   validity: "30 days" },
    { name: "12GB", dataAmount: "12GB", price: 42,   validity: "30 days" },
    { name: "15GB", dataAmount: "15GB", price: 50,   validity: "30 days" },
    { name: "20GB", dataAmount: "20GB", price: 65,   validity: "30 days" },
    { name: "25GB", dataAmount: "25GB", price: 80,   validity: "30 days" },
    { name: "30GB", dataAmount: "30GB", price: 95,   validity: "30 days" },
    { name: "35GB", dataAmount: "35GB", price: 110,  validity: "30 days" },
    { name: "40GB", dataAmount: "40GB", price: 125,  validity: "30 days" },
    { name: "45GB", dataAmount: "45GB", price: 140,  validity: "30 days" },
    { name: "50GB", dataAmount: "50GB", price: 155,  validity: "30 days" },
  ],
  TELECEL: [
    { name: "1GB",  dataAmount: "1GB",  price: 4,    validity: "30 days" },
    { name: "2GB",  dataAmount: "2GB",  price: 8,    validity: "30 days" },
    { name: "3GB",  dataAmount: "3GB",  price: 10,   validity: "30 days" },
    { name: "4GB",  dataAmount: "4GB",  price: 14,   validity: "30 days" },
    { name: "5GB",  dataAmount: "5GB",  price: 18,   validity: "30 days" },
    { name: "6GB",  dataAmount: "6GB",  price: 22,   validity: "30 days" },
    { name: "7GB",  dataAmount: "7GB",  price: 25,   validity: "30 days" },
    { name: "8GB",  dataAmount: "8GB",  price: 28,   validity: "30 days" },
    { name: "10GB", dataAmount: "10GB", price: 35,   validity: "30 days" },
    { name: "12GB", dataAmount: "12GB", price: 42,   validity: "30 days" },
    { name: "15GB", dataAmount: "15GB", price: 50,   validity: "30 days" },
    { name: "20GB", dataAmount: "20GB", price: 65,   validity: "30 days" },
    { name: "25GB", dataAmount: "25GB", price: 80,   validity: "30 days" },
    { name: "30GB", dataAmount: "30GB", price: 95,   validity: "30 days" },
    { name: "35GB", dataAmount: "35GB", price: 110,  validity: "30 days" },
    { name: "40GB", dataAmount: "40GB", price: 125,  validity: "30 days" },
    { name: "45GB", dataAmount: "45GB", price: 140,  validity: "30 days" },
    { name: "50GB", dataAmount: "50GB", price: 155,  validity: "30 days" },
  ],
  ISHARE: [
    { name: "1GB",  dataAmount: "1GB",  price: 3.5,  validity: "30 days" },
    { name: "2GB",  dataAmount: "2GB",  price: 7,    validity: "30 days" },
    { name: "3GB",  dataAmount: "3GB",  price: 9,    validity: "30 days" },
    { name: "4GB",  dataAmount: "4GB",  price: 12,   validity: "30 days" },
    { name: "5GB",  dataAmount: "5GB",  price: 15,   validity: "30 days" },
    { name: "6GB",  dataAmount: "6GB",  price: 18,   validity: "30 days" },
    { name: "7GB",  dataAmount: "7GB",  price: 21,   validity: "30 days" },
    { name: "8GB",  dataAmount: "8GB",  price: 24,   validity: "30 days" },
    { name: "10GB", dataAmount: "10GB", price: 30,   validity: "30 days" },
    { name: "12GB", dataAmount: "12GB", price: 36,   validity: "30 days" },
    { name: "15GB", dataAmount: "15GB", price: 44,   validity: "30 days" },
    { name: "20GB", dataAmount: "20GB", price: 58,   validity: "30 days" },
    { name: "25GB", dataAmount: "25GB", price: 72,   validity: "30 days" },
    { name: "30GB", dataAmount: "30GB", price: 85,   validity: "30 days" },
    { name: "35GB", dataAmount: "35GB", price: 99,   validity: "30 days" },
    { name: "40GB", dataAmount: "40GB", price: 112,  validity: "30 days" },
    { name: "45GB", dataAmount: "45GB", price: 126,  validity: "30 days" },
    { name: "50GB", dataAmount: "50GB", price: 140,  validity: "30 days" },
  ],
  BIGTIME: [
    { name: "1GB",  dataAmount: "1GB",  price: 3.5,  validity: "30 days" },
    { name: "2GB",  dataAmount: "2GB",  price: 7,    validity: "30 days" },
    { name: "3GB",  dataAmount: "3GB",  price: 9,    validity: "30 days" },
    { name: "4GB",  dataAmount: "4GB",  price: 12,   validity: "30 days" },
    { name: "5GB",  dataAmount: "5GB",  price: 15,   validity: "30 days" },
    { name: "6GB",  dataAmount: "6GB",  price: 18,   validity: "30 days" },
    { name: "7GB",  dataAmount: "7GB",  price: 21,   validity: "30 days" },
    { name: "8GB",  dataAmount: "8GB",  price: 24,   validity: "30 days" },
    { name: "10GB", dataAmount: "10GB", price: 30,   validity: "30 days" },
    { name: "12GB", dataAmount: "12GB", price: 36,   validity: "30 days" },
    { name: "15GB", dataAmount: "15GB", price: 44,   validity: "30 days" },
    { name: "20GB", dataAmount: "20GB", price: 58,   validity: "30 days" },
    { name: "25GB", dataAmount: "25GB", price: 72,   validity: "30 days" },
    { name: "30GB", dataAmount: "30GB", price: 85,   validity: "30 days" },
    { name: "35GB", dataAmount: "35GB", price: 99,   validity: "30 days" },
    { name: "40GB", dataAmount: "40GB", price: 112,  validity: "30 days" },
    { name: "45GB", dataAmount: "45GB", price: 126,  validity: "30 days" },
    { name: "50GB", dataAmount: "50GB", price: 140,  validity: "30 days" },
  ],
};

/* Attempt to dynamically fetch plans from the provider API (common endpoints) */
async function tryFetchPlansFromApi(
  config: ApiConfiguration
): Promise<Record<string, PlanDef[]> | null> {
  const possiblePaths = ["/products", "/plans", "/services", "/packages", "/data-plans"];
  for (const path of possiblePaths) {
    try {
      const data = await apiRequest<unknown>(config.baseUrl, path, {
        apiKey: config.apiKey,
        apiSecret: config.apiSecret ?? undefined,
      });
      // Try to parse response as plan data
      const raw = data as Record<string, unknown>;
      const list = Array.isArray(data) ? data : (raw?.data ?? raw?.products ?? raw?.plans ?? raw?.services ?? []);
      if (!Array.isArray(list) || list.length === 0) continue;

      const result: Record<string, PlanDef[]> = {};
      for (const item of list) {
        const entry = item as Record<string, unknown>;
        const networkName = (entry.network ?? entry.network_name ?? entry.category ?? "").toString().toUpperCase().trim();
        const name = (entry.name ?? entry.size ?? entry.data_amount ?? entry.plan ?? "").toString().trim();
        const price = Number(entry.price ?? entry.cost ?? entry.amount ?? 0);
        const dataAmount = (entry.data_amount ?? entry.dataAmount ?? entry.size ?? name).toString().trim();
        const validity = (entry.validity ?? entry.duration ?? "30 days").toString();
        if (!name || price <= 0) continue;
        const key = networkName || "UNKNOWN";
        if (!result[key]) result[key] = [];
        result[key].push({ name, dataAmount, price, validity });
      }
      if (Object.keys(result).length > 0) return result;
    } catch {
      // endpoint doesn't exist, try next
    }
  }
  return null;
}

function isV1Provider(config: { provider: string; endpoints?: unknown }) {
  return config.provider === "v1" || (config.endpoints as Record<string, string> | null)?.purchase?.includes("normal-orders");
}

function isGhBundleBaseUrl(baseUrl: string): boolean {
  const normalized = baseUrl.toLowerCase();
  return normalized.includes("ghbundle.com") || normalized.includes("ghbundle-reseller-api-proxy");
}

function resolveGhBundleEndpoint(path: string | undefined, fallback: string): string {
  const normalized = path?.trim() ?? "";
  if (!normalized) return fallback;
  const lower = normalized.toLowerCase();
  if (
    lower === "/" ||
    lower === "/normal-orders" ||
    lower === "/api/networks" ||
    lower === "/api/plans" ||
    lower === "/api/purchase"
  ) {
    return fallback;
  }
  return normalized;
}

type GhBundleService = {
  service_id?: string;
  network?: string;
  plan_name?: string;
  volume?: string;
  price?: number;
  validity?: string;
  status?: string;
};

type ProviderOrderState = "COMPLETED" | "PROCESSING" | "FAILED" | "UNKNOWN";

const PROVIDER_STATUS_KEYS = [
  "status",
  "order_status",
  "orderStatus",
  "state",
  "txstatus",
  "tx_status",
  "deliveryStatus",
  "delivery_status",
  "result"
] as const;

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toComparable(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim().toLowerCase();
  return "";
}

function toReadable(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function parseBooleanLike(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "ok", "success", "successful", "completed", "complete", "done", "approved", "paid"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "failed", "failure", "error", "declined", "rejected", "cancelled", "canceled"].includes(normalized)) {
    return false;
  }
  return null;
}

function classifyStatusValue(value: unknown): ProviderOrderState {
  const normalized = toComparable(value);
  if (!normalized) return "UNKNOWN";

  if (
    normalized === "1" ||
    normalized === "success" ||
    normalized === "successful" ||
    normalized === "completed" ||
    normalized === "complete" ||
    normalized === "approved" ||
    normalized === "delivered" ||
    normalized === "done" ||
    normalized === "fulfilled" ||
    normalized.includes("success") ||
    normalized.includes("complete") ||
    normalized.includes("deliver")
  ) {
    return "COMPLETED";
  }

  if (
    normalized === "0" ||
    normalized === "pending" ||
    normalized === "processing" ||
    normalized === "process" ||
    normalized === "inprogress" ||
    normalized === "in-progress" ||
    normalized === "in progress" ||
    normalized === "queued" ||
    normalized === "queue" ||
    normalized === "submitted" ||
    normalized === "initiated" ||
    normalized.includes("pending") ||
    normalized.includes("processing") ||
    normalized.includes("in progress")
  ) {
    return "PROCESSING";
  }

  if (
    normalized === "failed" ||
    normalized === "failure" ||
    normalized === "error" ||
    normalized === "declined" ||
    normalized === "rejected" ||
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized.includes("failed") ||
    normalized.includes("error") ||
    normalized.includes("declined") ||
    normalized.includes("reject") ||
    normalized.includes("cancel")
  ) {
    return "FAILED";
  }

  return "UNKNOWN";
}

function extractProviderState(payload: unknown): ProviderOrderState {
  const root = toObject(payload);
  if (!root) return "UNKNOWN";

  const nestedObjects = [
    root,
    toObject(root.order),
    toObject(root.data),
    toObject(root.result),
    toObject(root.transaction)
  ].filter((entry): entry is Record<string, unknown> => Boolean(entry));

  let sawProcessing = false;
  let sawFailed = false;
  for (const entry of nestedObjects) {
    for (const key of PROVIDER_STATUS_KEYS) {
      const status = classifyStatusValue(entry[key]);
      if (status === "COMPLETED") return "COMPLETED";
      if (status === "FAILED") sawFailed = true;
      if (status === "PROCESSING") sawProcessing = true;
    }
  }

  if (sawFailed) return "FAILED";
  if (sawProcessing) return "PROCESSING";

  const successSignals = [
    parseBooleanLike(root.success),
    parseBooleanLike(root.ok),
    parseBooleanLike(toObject(root.data)?.success),
    parseBooleanLike(toObject(root.data)?.ok)
  ].filter((signal): signal is boolean => signal != null);

  if (successSignals.includes(false)) return "FAILED";
  if (successSignals.includes(true)) return "PROCESSING";

  return "UNKNOWN";
}

function extractProviderMessage(payload: unknown): string | null {
  const root = toObject(payload);
  if (!root) return null;
  const messageCandidates = [
    root.message,
    root.msg,
    root.error,
    toObject(root.data)?.message,
    toObject(root.data)?.msg,
    toObject(root.order)?.message
  ];
  for (const candidate of messageCandidates) {
    const message = toReadable(candidate);
    if (message) return message;
  }
  return null;
}

function extractProviderReference(payload: unknown): string | null {
  const root = toObject(payload);
  if (!root) return null;

  const nestedOrder = toObject(root.order);
  const nestedData = toObject(root.data);
  const refs = [
    root.reference,
    root.reference_id,
    root.referenceId,
    root.order_id,
    root.orderId,
    root.client_order_id,
    root.clientOrderId,
    root.transactionId,
    root.transaction_id,
    root.externalref,
    root.externalRef,
    root.thirdpartyref,
    root.thirdPartyRef,
    root.id,
    nestedOrder?.reference_id,
    nestedOrder?.reference,
    nestedOrder?.order_id,
    nestedOrder?.orderId,
    nestedOrder?.client_order_id,
    nestedOrder?.clientOrderId,
    nestedOrder?.id,
    nestedData?.reference,
    nestedData?.reference_id,
    nestedData?.order_id,
    nestedData?.orderId,
    nestedData?.client_order_id,
    nestedData?.clientOrderId,
    nestedData?.transactionid,
    nestedData?.transactionId,
    nestedData?.externalref
  ];

  for (const candidate of refs) {
    const value = toReadable(candidate);
    if (value) return value;
  }
  return null;
}

function normalizeJsonObject(value: unknown): object {
  if (value && typeof value === "object") {
    return value as object;
  }
  return { value };
}

function appendQuery(path: string, key: string, value: string): string {
  const encodedKey = encodeURIComponent(key);
  const encodedValue = encodeURIComponent(value);
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${encodedKey}=${encodedValue}`;
}

function buildStatusPath(
  template: string,
  args: { reference?: string | null; orderId: string; orderNumber: string }
): string {
  const reference = args.reference ?? "";
  let path = template
    .replace(/\{reference\}/g, encodeURIComponent(reference))
    .replace(/\{ref\}/g, encodeURIComponent(reference))
    .replace(/\{orderId\}/g, encodeURIComponent(args.orderId))
    .replace(/\{orderNumber\}/g, encodeURIComponent(args.orderNumber));

  const hadPlaceholder = /\{reference\}|\{ref\}|\{orderId\}|\{orderNumber\}/.test(template);
  if (hadPlaceholder) return path;

  if (reference) {
    path = appendQuery(path, "reference", reference);
    return path;
  }
  return appendQuery(path, "orderNumber", args.orderNumber);
}

function collectProviderEntries(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => toObject(item))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }
  const root = toObject(payload);
  if (!root) return [];
  const possibleLists = [root.orders, root.data, root.results, root.transactions, root.items];
  for (const list of possibleLists) {
    if (!Array.isArray(list)) continue;
    return list
      .map((item) => toObject(item))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }
  return [];
}

function findProviderEntryByReference(
  payload: unknown,
  references: string[]
): Record<string, unknown> | null {
  const entries = collectProviderEntries(payload);
  if (entries.length === 0) return null;

  const normalizedReferences = references
    .map((value) => toComparable(value))
    .filter((value) => value.length > 0);

  if (normalizedReferences.length === 0) return null;

  for (const entry of entries) {
    const entryRef = toComparable(extractProviderReference(entry));
    if (entryRef && normalizedReferences.includes(entryRef)) {
      return entry;
    }
  }

  return null;
}

const LOGO_MAP: Record<string, string> = {
  MTN: "/images/networks/MTN-Logo.png",
  mtn: "/images/networks/MTN-Logo.png",
  TELECEL: "/images/networks/Telecel.webp",
  Telecel: "/images/networks/Telecel.webp",
  ISHARE: "/images/networks/MTN-Logo.png",
  BIGTIME: "/images/networks/MTN-Logo.png"
};

function planKey(network: string, plan: string) {
  return `${network}|${plan}`;
}

function parseDataAmountToMB(input: string): number {
  const normalized = input.trim().toLowerCase();
  const value = Number(normalized.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (normalized.includes("tb")) return Math.round(value * 1024 * 1024);
  if (normalized.includes("gb")) return Math.round(value * 1024);
  return Math.round(value);
}

function normalizeV1Key(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function resolveV1Network(rawNetworkName?: string | null): { name: V1NetworkName; apiId: number } {
  const normalized = normalizeV1Key(rawNetworkName ?? "");
  const aliasMap: Record<string, V1NetworkName> = {
    MTN: "MTN",
    TELECEL: "TELECEL",
    VODAFONE: "TELECEL",
    ISHARE: "ISHARE",
    BIGTIME: "BIGTIME",
    AIRTELTIGO: "BIGTIME",
    AIRTEL: "BIGTIME",
    TIGO: "BIGTIME",
    AT: "BIGTIME"
  };

  let resolvedName = aliasMap[normalized];
  if (!resolvedName && normalized.includes("VODAFONE")) resolvedName = "TELECEL";
  if (!resolvedName && normalized.includes("TELECEL")) resolvedName = "TELECEL";
  if (!resolvedName && (normalized.includes("AIRTEL") || normalized.includes("TIGO") || normalized.includes("BIGTIME"))) {
    resolvedName = "BIGTIME";
  }
  if (!resolvedName && normalized.includes("ISHARE")) resolvedName = "ISHARE";
  if (!resolvedName && normalized.includes("MTN")) resolvedName = "MTN";

  const finalName = resolvedName ?? "MTN";
  const network = V1_NETWORKS.find((n) => n.name === finalName);
  return {
    name: finalName,
    apiId: network?.apiId ?? 9
  };
}

function resolveV1PlanSize(
  networkName: V1NetworkName,
  dataPlan?: { name?: string | null; dataAmount?: string | null } | null
): string {
  const plans = V1_NETWORK_PLANS[networkName] ?? [];
  const candidates = [dataPlan?.dataAmount, dataPlan?.name]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0);

  for (const candidate of candidates) {
    const normalized = normalizeV1Key(candidate);
    const direct = plans.find((plan) => {
      return normalizeV1Key(plan.name) === normalized || normalizeV1Key(plan.dataAmount) === normalized;
    });
    if (direct) return direct.dataAmount;

    const candidateMb = parseDataAmountToMB(candidate);
    if (candidateMb <= 0) continue;
    const byAmount = plans.find((plan) => {
      const planNameMb = parseDataAmountToMB(plan.name);
      const planDataAmountMb = parseDataAmountToMB(plan.dataAmount);
      return candidateMb === planNameMb || candidateMb === planDataAmountMb;
    });
    if (byAmount) return byAmount.dataAmount;
  }

  return candidates[0] ?? "1GB";
}

type V1PurchasePayload = {
  beneficiary_number: string;
  network_id: number;
  size: string;
};

function buildV1SizeCandidates(size: string): string[] {
  const raw = size.trim();
  if (!raw) return [];

  const candidates: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const v = value.trim();
    if (!v) return;
    const key = v.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(v);
  };

  push(raw);
  push(raw.toLowerCase());
  push(raw.toLowerCase().replace(/\s+/g, ""));

  const gbMatch = raw.match(/^(\d+(?:\.\d+)?)\s*GB$/i);
  if (gbMatch) {
    const gb = Number(gbMatch[1]);
    if (Number.isFinite(gb) && gb > 0) {
      const compact = Number.isInteger(gb) ? String(Math.trunc(gb)) : String(gb);
      const mb = Math.round(gb * 1024);
      push(`${compact}gb`);
      push(`${compact} gb`);
      push(`${compact} GB`);
      push(`${mb}MB`);
      push(`${mb}mb`);
      push(`${mb} MB`);
      push(`${mb} mb`);
    }
  }

  const mbMatch = raw.match(/^(\d+(?:\.\d+)?)\s*MB$/i);
  if (mbMatch) {
    const mb = Number(mbMatch[1]);
    if (Number.isFinite(mb) && mb > 0) {
      const gb = mb / 1024;
      if (Number.isFinite(gb) && gb > 0) {
        const compact = Number.isInteger(gb) ? String(Math.trunc(gb)) : String(gb);
        push(`${compact}GB`);
        push(`${compact}gb`);
        push(`${compact} GB`);
        push(`${compact} gb`);
      }
    }
  }

  return candidates;
}

function mapGhBundleServicesToPreviewNetworks(services: GhBundleService[]): PreviewNetwork[] {
  const byNetwork = new Map<string, { displayName: string; plans: PreviewNetwork["plans"] }>();
  for (const service of services) {
    const network = (service.network ?? "").toString().trim();
    const planName = (service.plan_name ?? service.volume ?? service.service_id ?? "").toString().trim();
    const dataAmount = (service.volume ?? service.plan_name ?? planName).toString().trim();
    const price = Number(service.price ?? 0);
    if (!network || !planName || price <= 0) continue;
    const validity = (service.validity ?? "30 days").toString();
    const existing = byNetwork.get(network) ?? { displayName: network, plans: [] };
    existing.plans.push({ name: planName, dataAmount, price, validity });
    byNetwork.set(network, existing);
  }

  return Array.from(byNetwork.entries())
    .map(([name, value]) => ({
      name,
      displayName: value.displayName,
      plans: value.plans
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function fetchGhBundleServices(config: ApiConfiguration): Promise<GhBundleService[]> {
  const endpoints = (config.endpoints ?? {}) as EndpointsConfig;
  const servicesPath = resolveGhBundleEndpoint(endpoints.networks, "/services");
  const allServices: GhBundleService[] = [];

  let page = 1;
  let hasMore = true;
  while (hasMore && page <= 100) {
    const separator = servicesPath.includes("?") ? "&" : "?";
    const path = `${servicesPath}${separator}page=${page}&limit=100`;
    const payload = await apiRequest<
      | { services?: GhBundleService[]; data?: GhBundleService[]; pagination?: { page?: number; limit?: number; total?: number; has_more?: boolean } }
      | GhBundleService[]
    >(config.baseUrl, path, {
      method: "GET",
      apiKey: config.apiKey,
      apiSecret: config.apiSecret ?? undefined
    });

    const services = Array.isArray(payload)
      ? payload
      : payload.services ?? payload.data ?? [];
    if (Array.isArray(services) && services.length > 0) {
      allServices.push(...services);
    }

    if (Array.isArray(payload)) {
      hasMore = services.length >= 100;
    } else {
      const pagination = payload.pagination;
      if (pagination) {
        const pageNum = Number(pagination.page ?? page);
        const fallbackLimit = services.length > 0 ? services.length : 100;
        const limit = Number(pagination.limit ?? fallbackLimit);
        const total = Number(pagination.total ?? allServices.length);
        const hasMoreFlag = Boolean(pagination.has_more);
        hasMore = hasMoreFlag || pageNum * limit < total;
      } else {
        hasMore = services.length >= 100;
      }
    }

    page++;
  }

  return allServices;
}

async function syncV1NetworksAndPlans(
  config: ApiConfiguration,
  options?: {
    markupPercent?: number;
    networkMarkups?: Record<string, number>;
    planMarkups?: Record<string, number>;
    networksToImport?: string[];
    servicesToImport?: Array<{ network: string; plan: string }>;
    networkLogos?: Record<string, string>;
  }
): Promise<{ ok: boolean; networksAdded: number; plansAdded: number; error?: string }> {
  const networksToImport = options?.networksToImport;
  const servicesToImport = options?.servicesToImport;
  const networkLogos = options?.networkLogos ?? {};
  const networkMarkups = options?.networkMarkups ?? {};
  const planMarkups = options?.planMarkups ?? {};
  const markupPercent = options?.markupPercent ?? 0;
  const applyMarkup = (basePrice: number, networkName: string, planName?: string) => {
    const planPct = planName != null ? planMarkups[planKey(networkName, planName)] : undefined;
    const netPct = networkMarkups[networkName];
    const pct = planPct ?? netPct ?? markupPercent;
    const final = Math.round(basePrice * (1 + pct / 100) * 100) / 100;
    console.log(`[sync] markup ${networkName}/${planName}: base=${basePrice}, pct=${pct}%, final=${final}`);
    return final;
  };

  let networksAdded = 0;
  let plansAdded = 0;

  /* V1 providers use our hardcoded plan catalog — skip dynamic API fetch to avoid
     mismatched plan names or prices that would bypass the markup logic. */

  const allowedPlansByNetwork = new Map<string, Set<string>>();
  if (servicesToImport && servicesToImport.length > 0) {
    for (const s of servicesToImport) {
      if (!allowedPlansByNetwork.has(s.network)) {
        allowedPlansByNetwork.set(s.network, new Set());
      }
      allowedPlansByNetwork.get(s.network)!.add(s.plan);
    }
  }

  for (let i = 0; i < V1_NETWORKS.length; i++) {
    const vn = V1_NETWORKS[i];
    if (networksToImport && networksToImport.length > 0 && !networksToImport.includes(vn.name)) {
      continue;
    }
    if (allowedPlansByNetwork.size > 0 && !allowedPlansByNetwork.has(vn.name)) {
      continue;
    }

    const allowedPlans = allowedPlansByNetwork.get(vn.name);
    const customLogo = networkLogos[vn.name];
    const logoUrl = (customLogo?.trim() || LOGO_MAP[vn.name] || LOGO_MAP[vn.name.toLowerCase()] || "/images/networks/MTN-Logo.png");

    const network = await prisma.network.upsert({
      where: { name: vn.name },
      create: {
        name: vn.name,
        displayName: vn.displayName,
        logoUrl,
        sortOrder: i + 1
      },
      update: { displayName: vn.displayName, logoUrl, sortOrder: i + 1 }
    });
    networksAdded++;

    /* Always use our curated plan catalog for V1 providers */
    const plansForNetwork = V1_NETWORK_PLANS[vn.name] ?? V1_NETWORK_PLANS["MTN"];

    for (let j = 0; j < plansForNetwork.length; j++) {
      const p = plansForNetwork[j];
      if (allowedPlans && !allowedPlans.has(p.name)) continue;
      const price = applyMarkup(p.price, vn.name, p.name);
      const dataInMB = parseInt(p.dataAmount.replace(/\D/g, ""), 10) * (p.dataAmount.toLowerCase().includes("gb") ? 1024 : 1) || 1024;
      await prisma.dataPlan.upsert({
        where: { networkId_name: { networkId: network.id, name: p.name } },
        create: {
          networkId: network.id,
          name: p.name,
          dataAmount: p.dataAmount,
          dataInMB,
          price,
          validity: p.validity,
          sortOrder: j + 1
        },
        update: { dataAmount: p.dataAmount, dataInMB, price, validity: p.validity, sortOrder: j + 1 }
      });
      plansAdded++;
    }
  }

  return { ok: true, networksAdded, plansAdded };
}

async function syncGhBundleNetworksAndPlans(
  config: ApiConfiguration,
  options?: {
    markupPercent?: number;
    networkMarkups?: Record<string, number>;
    planMarkups?: Record<string, number>;
    networksToImport?: string[];
    servicesToImport?: Array<{ network: string; plan: string }>;
    networkLogos?: Record<string, string>;
  }
): Promise<{ ok: boolean; networksAdded: number; plansAdded: number; error?: string }> {
  const networkLogos = options?.networkLogos ?? {};
  const networkMarkups = options?.networkMarkups ?? {};
  const planMarkups = options?.planMarkups ?? {};
  const markupPercent = options?.markupPercent ?? 0;
  const networksToImport = options?.networksToImport;
  const servicesToImport = options?.servicesToImport;

  const applyMarkup = (basePrice: number, networkName: string, planName: string) => {
    const planPct = planMarkups[planKey(networkName, planName)];
    const netPct = networkMarkups[networkName];
    const pct = planPct ?? netPct ?? markupPercent;
    return Math.round(basePrice * (1 + pct / 100) * 100) / 100;
  };

  const allowedPlansByNetwork = new Map<string, Set<string>>();
  if (servicesToImport && servicesToImport.length > 0) {
    for (const service of servicesToImport) {
      if (!allowedPlansByNetwork.has(service.network)) {
        allowedPlansByNetwork.set(service.network, new Set());
      }
      allowedPlansByNetwork.get(service.network)!.add(service.plan);
    }
  }

  let networksAdded = 0;
  let plansAdded = 0;

  try {
    const services = await fetchGhBundleServices(config);
    if (services.length === 0) {
      return {
        ok: true,
        networksAdded: 0,
        plansAdded: 0,
        error: "No services returned from GhBundle."
      };
    }

    const grouped = new Map<string, GhBundleService[]>();
    for (const service of services) {
      const networkName = (service.network ?? "").toString().trim();
      if (!networkName) continue;
      if (networksToImport && networksToImport.length > 0 && !networksToImport.includes(networkName)) {
        continue;
      }
      if (!grouped.has(networkName)) grouped.set(networkName, []);
      grouped.get(networkName)!.push(service);
    }

    let networkSort = 1;
    for (const [networkName, networkServices] of grouped.entries()) {
      if (allowedPlansByNetwork.size > 0 && !allowedPlansByNetwork.has(networkName)) {
        continue;
      }

      const customLogo = networkLogos[networkName];
      const logoUrl =
        customLogo?.trim() ||
        LOGO_MAP[networkName] ||
        LOGO_MAP[networkName.toUpperCase()] ||
        LOGO_MAP[networkName.toLowerCase()] ||
        "/images/networks/MTN-Logo.png";

      const network = await prisma.network.upsert({
        where: { name: networkName },
        create: {
          name: networkName,
          displayName: networkName,
          logoUrl,
          sortOrder: networkSort
        },
        update: {
          displayName: networkName,
          logoUrl,
          sortOrder: networkSort
        }
      });
      networksAdded++;
      networkSort++;

      const seenPlanNames = new Set<string>();
      const allowedPlans = allowedPlansByNetwork.get(networkName);
      let planSort = 1;
      for (const service of networkServices) {
        const planName = (service.plan_name ?? service.volume ?? service.service_id ?? "").toString().trim();
        if (!planName) continue;
        if (allowedPlans && !allowedPlans.has(planName)) continue;
        if (seenPlanNames.has(planName)) continue;
        seenPlanNames.add(planName);

        const dataAmount = (service.volume ?? service.plan_name ?? planName).toString();
        const basePrice = Number(service.price ?? 0);
        if (basePrice <= 0) continue;
        const price = applyMarkup(basePrice, networkName, planName);
        const dataInMB = parseDataAmountToMB(dataAmount) || 1024;
        const validity = (service.validity ?? "30 days").toString();

        await prisma.dataPlan.upsert({
          where: { networkId_name: { networkId: network.id, name: planName } },
          create: {
            networkId: network.id,
            name: planName,
            dataAmount,
            dataInMB,
            price,
            validity,
            sortOrder: planSort
          },
          update: {
            dataAmount,
            dataInMB,
            price,
            validity,
            sortOrder: planSort
          }
        });
        plansAdded++;
        planSort++;
      }
    }

    return { ok: true, networksAdded, plansAdded };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, networksAdded, plansAdded, error: msg };
  }
}

async function fetchProviderOrderStatusPayload(
  config: ApiConfiguration,
  order: {
    id: string;
    orderNumber: string;
    paymentReference: string | null;
    apiResponsePayload: unknown;
  }
): Promise<unknown | null> {
  const endpoints = (config.endpoints ?? {}) as EndpointsConfig;
  const providerReference = extractProviderReference(order.apiResponsePayload) ?? order.paymentReference;
  const isGhBundle = isGhBundleBaseUrl(config.baseUrl);

  if (endpoints.status) {
    const statusTemplate = isGhBundle
      ? resolveGhBundleEndpoint(endpoints.status, "/orders/{reference}")
      : endpoints.status;
    const statusPath = buildStatusPath(statusTemplate, {
      reference: providerReference,
      orderId: order.id,
      orderNumber: order.orderNumber
    });
    try {
      return await apiRequest<unknown>(config.baseUrl, statusPath, {
        method: "GET",
        apiKey: config.apiKey,
        apiSecret: config.apiSecret ?? undefined
      });
    } catch (error) {
      console.warn("[provider status] Status endpoint failed:", statusPath, error);
    }
  }

  if (isGhBundle) {
    if (providerReference) {
      const statusPath = `/orders/${encodeURIComponent(providerReference)}`;
      try {
        return await apiRequest<unknown>(config.baseUrl, statusPath, {
          method: "GET",
          apiKey: config.apiKey,
          apiSecret: config.apiSecret ?? undefined
        });
      } catch (error) {
        console.warn("[provider status] GhBundle order lookup failed:", statusPath, error);
      }
    }

    try {
      const listPath = "/orders?page=1&limit=50";
      const listPayload = await apiRequest<unknown>(config.baseUrl, listPath, {
        method: "GET",
        apiKey: config.apiKey,
        apiSecret: config.apiSecret ?? undefined
      });
      const matched = findProviderEntryByReference(listPayload, [
        providerReference ?? "",
        order.orderNumber,
        order.id
      ]);
      if (matched) return matched;
    } catch (error) {
      console.warn("[provider status] GhBundle list fallback failed:", error);
    }
  }

  if (isV1Provider(config)) {
    const purchasePath = endpoints.purchase ?? "/normal-orders";
    if (providerReference) {
      const pathWithReference = appendQuery(purchasePath, "reference", providerReference);
      try {
        const scopedPayload = await apiRequest<unknown>(config.baseUrl, pathWithReference, {
          method: "GET",
          apiKey: config.apiKey,
          apiSecret: config.apiSecret ?? undefined
        });
        const scopedMatch = findProviderEntryByReference(scopedPayload, [providerReference]);
        if (scopedMatch) return scopedMatch;
        if (!Array.isArray(scopedPayload)) return scopedPayload;
      } catch {
        // Continue with unscoped fallback
      }
    }

    try {
      const payload = await apiRequest<unknown>(config.baseUrl, purchasePath, {
        method: "GET",
        apiKey: config.apiKey,
        apiSecret: config.apiSecret ?? undefined
      });
      const matched = findProviderEntryByReference(payload, [
        providerReference ?? "",
        order.paymentReference ?? "",
        order.orderNumber,
        order.id
      ]);
      if (matched) return matched;
      if (!Array.isArray(payload)) return payload;
      return null;
    } catch (error) {
      console.warn("[provider status] V1 fallback status lookup failed:", error);
    }
  }

  return null;
}

async function markOrderCompleted(
  orderId: string,
  apiRequestPayload: object,
  apiResponsePayload: object
): Promise<void> {
  const updated = await prisma.order.updateMany({
    where: {
      id: orderId,
      status: { in: ["PENDING", "PROCESSING", "FAILED"] }
    },
    data: {
      status: "COMPLETED",
      paymentStatus: "COMPLETED",
      completedAt: new Date(),
      failedReason: null,
      apiRequestPayload,
      apiResponsePayload
    }
  });

  if (updated.count === 0) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        apiRequestPayload,
        apiResponsePayload
      }
    }).catch(() => {});
    return;
  }

  try {
    const { orderService } = await import("@/backend/services/orders/orderService");
    await orderService.grantRewardsForCompletedOrder(orderId);
  } catch (rewardErr) {
    console.error("[provider] Reward grant error:", rewardErr);
  }

  try {
    const { enqueueWebhookIfStatusChanged } = await import("@/backend/services/reseller/statusHooks");
    await enqueueWebhookIfStatusChanged(orderId);
  } catch (webhookErr) {
    console.error("[provider] Reseller webhook enqueue error:", webhookErr);
  }

  try {
    const { sendOrderCompleteSms } = await import("@/backend/services/smsNotifications");
    await sendOrderCompleteSms(orderId);
  } catch (smsErr) {
    console.error("[provider] Order complete SMS error:", smsErr);
  }
}

async function markOrderFailed(
  orderId: string,
  failedReason: string,
  apiRequestPayload: object,
  apiResponsePayload?: object
): Promise<void> {
  const updated = await prisma.order.updateMany({
    where: {
      id: orderId,
      status: { in: ["PENDING", "PROCESSING"] }
    },
    data: {
      status: "FAILED",
      failedReason,
      completedAt: null,
      apiRequestPayload,
      apiResponsePayload
    }
  });

  if (updated.count === 0) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        failedReason,
        apiRequestPayload,
        apiResponsePayload
      }
    }).catch(() => {});
    return;
  }

  try {
    const { orderService } = await import("@/backend/services/orders/orderService");
    await orderService.refundFailedOrder(orderId);
  } catch (refundErr) {
    console.error("[provider] Refund error:", refundErr);
  }

  try {
    const { enqueueWebhookIfStatusChanged } = await import("@/backend/services/reseller/statusHooks");
    await enqueueWebhookIfStatusChanged(orderId);
  } catch (webhookErr) {
    console.error("[provider] Reseller webhook enqueue error:", webhookErr);
  }
}

async function syncOrderStatusInternal(orderId: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      paymentReference: true,
      apiRequestPayload: true,
      apiResponsePayload: true
    }
  });

  if (!order) {
    return { ok: false, error: "Order not found." };
  }

  if (["COMPLETED", "FAILED", "CANCELLED"].includes(order.status)) {
    return { ok: true, status: order.status };
  }

  if (order.status !== "PROCESSING") {
    return { ok: true, status: order.status };
  }

  const config = await getActiveConfig();
  if (!config) {
    return { ok: false, status: order.status, error: "No API configuration found." };
  }

  const statusPayload = await fetchProviderOrderStatusPayload(config, {
    id: order.id,
    orderNumber: order.orderNumber,
    paymentReference: order.paymentReference,
    apiResponsePayload: order.apiResponsePayload
  });

  if (!statusPayload) {
    return { ok: true, status: order.status };
  }

  const providerState = extractProviderState(statusPayload);
  if (providerState === "COMPLETED") {
    await markOrderCompleted(
      order.id,
      normalizeJsonObject(order.apiRequestPayload ?? {}),
      normalizeJsonObject(statusPayload)
    );
    return { ok: true, status: "COMPLETED" };
  }

  if (providerState === "FAILED") {
    const reason = extractProviderMessage(statusPayload) ?? "Provider marked this order as failed.";
    await markOrderFailed(
      order.id,
      reason,
      normalizeJsonObject(order.apiRequestPayload ?? {}),
      normalizeJsonObject(statusPayload)
    );
    return { ok: false, status: "FAILED", error: reason };
  }

  await prisma.order.updateMany({
    where: {
      id: order.id,
      status: { in: ["PENDING", "PROCESSING", "FAILED"] }
    },
    data: {
      status: "PROCESSING",
      paymentStatus: "COMPLETED",
      failedReason: null,
      apiResponsePayload: normalizeJsonObject(statusPayload)
    }
  });

  return { ok: true, status: "PROCESSING" };
}

export const dataProviderService = {
  async previewNetworks(configId: string): Promise<{ ok: boolean; networks: PreviewNetwork[]; error?: string }> {
    const config = await prisma.apiConfiguration.findUnique({ where: { id: configId } });
    if (!config) {
      return { ok: false, networks: [], error: "API configuration not found." };
    }

    if (isV1Provider(config)) {
      return {
        ok: true,
        networks: V1_NETWORKS.map((n) => ({
          name: n.name,
          displayName: n.displayName,
          plans: V1_NETWORK_PLANS[n.name] ?? V1_NETWORK_PLANS["MTN"]
        }))
      };
    }

    if (isGhBundleBaseUrl(config.baseUrl)) {
      try {
        const services = await fetchGhBundleServices(config);
        const networks = mapGhBundleServicesToPreviewNetworks(services);
        return { ok: true, networks };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return { ok: false, networks: [], error: msg };
      }
    }

    const endpoints = (config.endpoints ?? {}) as EndpointsConfig;
    const networksPath = endpoints.networks ?? "/api/networks";
    const plansPath = endpoints.plans ?? "/api/plans";

    try {
      const allNetworks: Array<{ id?: string; name: string; displayName?: string; plans?: unknown[] }> = [];
      let page = 1;
      let networksLastPage = 1;
      do {
        const separator = networksPath.includes("?") ? "&" : "?";
        const path = page === 1 ? networksPath : `${networksPath}${separator}page=${page}`;
        const networksData = await apiRequest<
          | { networks?: unknown[]; data?: unknown[]; last_page?: number }
          | Array<{ id?: string; name: string; displayName?: string; plans?: unknown[] }>
        >(
          config.baseUrl,
          path,
          { apiKey: config.apiKey, apiSecret: config.apiSecret ?? undefined }
        );
        const raw = networksData as { networks?: unknown[]; data?: unknown[]; last_page?: number };
        const chunk = Array.isArray(networksData)
          ? networksData
          : raw?.networks ?? raw?.data ?? [];
        if (Array.isArray(chunk)) allNetworks.push(...(chunk as Array<{ id?: string; name: string; displayName?: string; plans?: unknown[] }>));
        networksLastPage = raw?.last_page ?? 1;
        page++;
      } while (page <= networksLastPage && page <= 100);

      const networksList = allNetworks;

      if (networksList.length === 0) {
        return {
          ok: true,
          networks: [],
          error: "No networks returned from API."
        };
      }

      const result: PreviewNetwork[] = [];

      for (const n of networksList) {
        const net = n as { id?: string; name: string; displayName?: string; plans?: unknown[] };
        const name = (net.name ?? net.id ?? "").toString().trim();
        if (!name) continue;

        const displayName = net.displayName ?? name;
        let plans: PreviewNetwork["plans"] = [];

        const embeddedPlans = net.plans;
        if (Array.isArray(embeddedPlans) && embeddedPlans.length > 0) {
          for (let j = 0; j < embeddedPlans.length; j++) {
            const p = embeddedPlans[j] as { id?: string; name?: string; dataAmount?: string; dataInMB?: number; price?: number; validity?: string };
            const planName = (p.name ?? p.id ?? `Plan ${j + 1}`).toString().trim();
            const dataAmount = p.dataAmount ?? (p.dataInMB != null ? `${p.dataInMB}MB` : "0MB");
            const price = Number(p.price) || 0;
            const validity = p.validity ?? "30 days";
            if (!planName || price <= 0) continue;
            plans.push({ name: planName, dataAmount, price, validity });
          }
        } else {
          const plansPathBase = plansPath
            .replace("{networkId}", name)
            .replace("{network}", name)
            .replace("{networkName}", name);
          try {
            const plansPathResolved = plansPathBase;
            const plansData = await apiRequest<
              | { plans?: unknown[]; data?: unknown[]; page?: number; last_page?: number; total?: number; next_page_url?: string | null }
              | unknown[]
            >(
              config.baseUrl,
              plansPathResolved,
              { apiKey: config.apiKey, apiSecret: config.apiSecret ?? undefined }
            );
            const raw = plansData as { plans?: unknown[]; data?: unknown[]; last_page?: number; next_page_url?: string | null };
            const plansList0 = Array.isArray(plansData)
              ? plansData
              : raw?.plans ?? raw?.data ?? [];
            for (let j = 0; j < plansList0.length; j++) {
              const p = plansList0[j] as { id?: string; name?: string; dataAmount?: string; dataInMB?: number; price?: number; validity?: string };
              const planName = (p.name ?? p.id ?? `Plan ${j + 1}`).toString().trim();
              const dataAmount = p.dataAmount ?? (p.dataInMB != null ? `${p.dataInMB}MB` : "0MB");
              const price = Number(p.price) || 0;
              const validity = p.validity ?? "30 days";
              if (!planName || price <= 0) continue;
              plans.push({ name: planName, dataAmount, price, validity });
            }
            const lastPage = raw?.last_page ?? 1;
            for (let page = 2; page <= lastPage && page <= 100; page++) {
              const separator = plansPathBase.includes("?") ? "&" : "?";
              const nextPath = `${plansPathBase}${separator}page=${page}`;
              const nextData = await apiRequest<{ plans?: unknown[]; data?: unknown[] } | unknown[]>(
                config.baseUrl,
                nextPath,
                { apiKey: config.apiKey, apiSecret: config.apiSecret ?? undefined }
              );
              const nextRaw = nextData as { plans?: unknown[]; data?: unknown[] };
              const nextList = Array.isArray(nextData) ? nextData : nextRaw?.plans ?? nextRaw?.data ?? [];
              for (let j = 0; j < nextList.length; j++) {
                const p = nextList[j] as { id?: string; name?: string; dataAmount?: string; dataInMB?: number; price?: number; validity?: string };
                const planName = (p.name ?? p.id ?? `Plan ${j + 1}`).toString().trim();
                const dataAmount = p.dataAmount ?? (p.dataInMB != null ? `${p.dataInMB}MB` : "0MB");
                const price = Number(p.price) || 0;
                const validity = p.validity ?? "30 days";
                if (!planName || price <= 0) continue;
                plans.push({ name: planName, dataAmount, price, validity });
              }
            }
          } catch {
            /* skip this network's plans */
          }
        }

        result.push({ name, displayName, plans });
      }

      return { ok: true, networks: result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, networks: [], error: msg };
    }
  },

  async testConnection(configId?: string): Promise<{ ok: boolean; message: string }> {
    let config: ApiConfiguration | null = null;
    let testPath: string = "/";
    let baseUrl = "";
    
    try {
      config = configId
        ? await prisma.apiConfiguration.findUnique({ where: { id: configId } })
        : await getActiveConfig();

      if (!config) {
        return { ok: false, message: "No API configuration found. Add one in Settings > API Configuration." };
      }

      if (!config.apiKey || !config.apiKey.trim()) {
        console.error("[testConnection] API key is missing or empty");
        return { ok: false, message: "API key is missing. Please add your API key in Settings > API Configuration." };
      }

      baseUrl = config.baseUrl;
      const endpoints = (config.endpoints ?? {}) as EndpointsConfig;
      // Detect GhBundle API (direct or proxy URLs)
      const isGhBundle = isGhBundleBaseUrl(baseUrl);
      
      // For GhBundle, try /balance first, then /services as fallback
      // Use /balance for GhBundle (simple GET endpoint), /normal-orders for V1, or custom test endpoint
      testPath = endpoints.test ?? "";
      if (isGhBundle) {
        testPath = resolveGhBundleEndpoint(testPath, "/balance");
      } else if (!testPath) {
        if (isV1Provider(config)) {
          testPath = "/normal-orders";
        } else {
          testPath = "/";
        }
      }

      const fullUrl = getUrl(baseUrl, testPath);
      console.log("[testConnection] Testing:", { 
        baseUrl, 
        testPath, 
        fullUrl,
        isGhBundle, 
        hasApiKey: Boolean(config.apiKey),
        customTestEndpoint: Boolean(endpoints.test)
      });

      try {
        const result = await apiRequest(baseUrl, testPath, {
          method: "GET",
          apiKey: config.apiKey,
          apiSecret: config.apiSecret ?? undefined
        });
        console.log("[testConnection] Success - response:", typeof result === "object" ? JSON.stringify(result).slice(0, 200) : "ok");
        return { ok: true, message: "Connection successful." };
      } catch (firstError) {
        // For GhBundle, if /balance fails with 404, try /services as fallback
        if (isGhBundle && testPath === "/balance") {
          const status = (firstError as { status?: number })?.status;
          const errBody = (firstError as { body?: string })?.body || "";
          const isHtmlError = errBody.trim().startsWith("<!DOCTYPE") || errBody.trim().startsWith("<!doctype") || errBody.trim().startsWith("<html");
          
          if (status === 404 && isHtmlError) {
            console.log("[testConnection] /balance returned 404 HTML, trying /services as fallback");
            try {
              const fallbackResult = await apiRequest(baseUrl, "/services", {
                method: "GET",
                apiKey: config.apiKey,
                apiSecret: config.apiSecret ?? undefined
              });
              console.log("[testConnection] Fallback /services success - response:", typeof fallbackResult === "object" ? JSON.stringify(fallbackResult).slice(0, 200) : "ok");
              return { ok: true, message: "Connection successful (tested via /services endpoint)." };
            } catch (fallbackError) {
              // If fallback also fails, throw the original error
              throw firstError;
            }
          }
        }
        // Re-throw if not a fallback case
        throw firstError;
      }
    } catch (err) {
      console.error("[testConnection] Error:", err);
      const status = (err as { status?: number })?.status;
      const errBody = (err as { body?: string })?.body || "";
      const isHtmlError = errBody.trim().startsWith("<!DOCTYPE") || errBody.trim().startsWith("<!doctype") || errBody.trim().startsWith("<html");
      
      if (status === 401 || status === 403) {
        return { ok: false, message: "Authentication failed. Check your API token." };
      }
      
      if (status === 404 && isHtmlError) {
        // 404 with HTML usually means wrong endpoint or authentication issue
        const isGhBundleUrl = baseUrl && isGhBundleBaseUrl(baseUrl);
        if (isGhBundleUrl) {
          return { 
            ok: false, 
            message: `Endpoint not found (404). This usually means: 1) Your API key is invalid or missing, 2) The endpoint doesn't exist on this API version, or 3) Authentication failed. Verify your API key in Settings > API Configuration and ensure it matches your GhBundle account.` 
          };
        }
        return { 
          ok: false, 
          message: `Endpoint not found (404). The test endpoint "${testPath}" does not exist on "${baseUrl || "your API"}". Check your base URL and endpoint configuration. If using GhBundle, use base URL: https://ghbundle.com/api/v1.` 
        };
      }
      
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, message: `Connection failed: ${msg}` };
    }
  },

  async syncNetworksAndPlans(
    configId?: string,
    options?: {
      markupPercent?: number;
      networkMarkups?: Record<string, number>;
      planMarkups?: Record<string, number>;
      networksToImport?: string[];
      servicesToImport?: Array<{ network: string; plan: string }>;
      networkLogos?: Record<string, string>;
    }
  ): Promise<{
    ok: boolean;
    networksAdded: number;
    plansAdded: number;
    error?: string;
  }> {
    const config = configId
      ? await prisma.apiConfiguration.findUnique({ where: { id: configId } })
      : await getActiveConfig();

    if (!config) {
      return {
        ok: false,
        networksAdded: 0,
        plansAdded: 0,
        error: "No API configuration found."
      };
    }

    if (isGhBundleBaseUrl(config.baseUrl)) {
      return syncGhBundleNetworksAndPlans(config, options);
    }

    if (isV1Provider(config)) {
      return syncV1NetworksAndPlans(config, options);
    }

    const endpoints = (config.endpoints ?? {}) as EndpointsConfig;
    const networksPath = endpoints.networks ?? "/api/networks";
    const plansPath = endpoints.plans ?? "/api/plans";

    let networksAdded = 0;
    let plansAdded = 0;

    try {
      const networksData = await apiRequest<
        | { networks?: Array<{ id?: string; name: string; displayName?: string; plans?: unknown[] }> }
        | Array<{ id?: string; name: string; displayName?: string; plans?: unknown[] }>
      >(
        config.baseUrl,
        networksPath,
        { apiKey: config.apiKey, apiSecret: config.apiSecret ?? undefined }
      );

      const networksList = Array.isArray(networksData)
        ? networksData
        : (networksData as { networks?: unknown[] }).networks ?? [];

      if (!Array.isArray(networksList) || networksList.length === 0) {
        return {
          ok: true,
          networksAdded: 0,
          plansAdded: 0,
          error: "No networks returned from API. Check your endpoint path and response format."
        };
      }

      const logoMap: Record<string, string> = {
        MTN: "/images/networks/MTN-Logo.png",
        mtn: "/images/networks/MTN-Logo.png",
        Telecel: "/images/networks/Telecel.webp",
        Vodafone: "/images/networks/Telecel.webp",
        vodafone: "/images/networks/Telecel.webp",
        AirtelTigo: "/images/networks/airteltigo.png",
        airteltigo: "/images/networks/airteltigo.png"
      };

      const markupPercent = options?.markupPercent ?? 0;
      const networkMarkups = options?.networkMarkups ?? {};
      const planMarkupsGeneric = options?.planMarkups ?? {};
      const applyMarkup = (p: number, networkName?: string, planName?: string) => {
        const planPct = planName && networkName ? planMarkupsGeneric[`${networkName}|${planName}`] : undefined;
        const netPct = networkName && networkMarkups[networkName] != null ? networkMarkups[networkName] : undefined;
        const pct = planPct ?? netPct ?? markupPercent;
        console.log(`[sync-generic] markup ${networkName}/${planName}: base=${p}, pct=${pct}%, final=${Math.round(p * (1 + pct / 100) * 100) / 100}`);
        return Math.round(p * (1 + pct / 100) * 100) / 100;
      };
      const networksToImport = options?.networksToImport;
      const networkLogos = options?.networkLogos ?? {};

      for (let i = 0; i < networksList.length; i++) {
        const n = networksList[i] as { id?: string; name: string; displayName?: string };
        const name = (n.name ?? n.id ?? "").toString().trim();
        if (!name) continue;

        if (networksToImport && networksToImport.length > 0 && !networksToImport.includes(name)) {
          continue;
        }

        const displayName = n.displayName ?? name;
        const customLogo = networkLogos[name];
        const defaultLogo = logoMap[name] ?? logoMap[name.toLowerCase()] ?? "/images/networks/MTN-Logo.png";
        const logoUrl = (customLogo?.trim() || defaultLogo);

        const network = await prisma.network.upsert({
          where: { name },
          create: {
            name,
            displayName,
            logoUrl,
            sortOrder: i + 1
          },
          update: { displayName, logoUrl, sortOrder: i + 1 }
        });

        if (network) networksAdded++;

        const embeddedPlans = (n as { plans?: unknown[] }).plans;
        if (Array.isArray(embeddedPlans) && embeddedPlans.length > 0) {
          for (let j = 0; j < embeddedPlans.length; j++) {
            const p = embeddedPlans[j] as { id?: string; name?: string; dataAmount?: string; dataInMB?: number; price?: number; validity?: string };
            const planName = (p.name ?? p.id ?? `Plan ${j + 1}`).toString().trim();
            const dataAmount = p.dataAmount ?? (p.dataInMB != null ? `${p.dataInMB}MB` : "0MB");
            const dataInMB = p.dataInMB ?? (parseInt(String(dataAmount).replace(/\D/g, ""), 10) || 0);
            const basePrice = Number(p.price) || 0;
            const price = applyMarkup(basePrice, name, planName);
            const validity = p.validity ?? "30 days";
            if (!planName || basePrice <= 0) continue;
            await prisma.dataPlan.upsert({
              where: { networkId_name: { networkId: network.id, name: planName } },
              create: {
                networkId: network.id,
                name: planName,
                dataAmount,
                dataInMB: dataInMB || 1024,
                price,
                validity,
                sortOrder: j + 1
              },
              update: { dataAmount, dataInMB: dataInMB || 1024, price, validity, sortOrder: j + 1 }
            });
            plansAdded++;
          }
          continue;
        }

        try {
          const plansPathResolved = plansPath
            .replace("{networkId}", name)
            .replace("{network}", name)
            .replace("{networkName}", name);

          const plansData = await apiRequest<{ plans?: Array<{ id?: string; name?: string; networkId?: string; network?: string; dataAmount?: string; dataInMB?: number; price?: number; validity?: string }> } | Array<{ id?: string; name?: string; networkId?: string; network?: string; dataAmount?: string; dataInMB?: number; price?: number; validity?: string }>>(
            config.baseUrl,
            plansPathResolved,
            { apiKey: config.apiKey, apiSecret: config.apiSecret ?? undefined }
          );

          const plansList = Array.isArray(plansData)
            ? plansData
            : (plansData as { plans?: unknown[] }).plans ?? [];

          const relevantPlans = Array.isArray(plansList) ? plansList : [];

          for (let j = 0; j < relevantPlans.length; j++) {
            const p = relevantPlans[j] as { id?: string; name?: string; dataAmount?: string; dataInMB?: number; price?: number; validity?: string };
            const planName = (p.name ?? p.id ?? `Plan ${j + 1}`).toString().trim();
            const dataAmount = p.dataAmount ?? (p.dataInMB != null ? `${p.dataInMB}MB` : "0MB");
            const dataInMB = p.dataInMB ?? (parseInt(String(dataAmount).replace(/\D/g, ""), 10) || 0);
            const basePrice = Number(p.price) || 0;
            const price = applyMarkup(basePrice, name, planName);
            const validity = p.validity ?? "30 days";

            if (!planName || basePrice <= 0) continue;

            await prisma.dataPlan.upsert({
              where: { networkId_name: { networkId: network.id, name: planName } },
              create: {
                networkId: network.id,
                name: planName,
                dataAmount,
                dataInMB: dataInMB || 1024,
                price,
                validity,
                sortOrder: j + 1
              },
              update: { dataAmount, dataInMB: dataInMB || 1024, price, validity, sortOrder: j + 1 }
            });
            plansAdded++;
          }
        } catch {
          // Plans endpoint may not exist or have different structure - skip
        }
      }

      return { ok: true, networksAdded, plansAdded };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return {
        ok: false,
        networksAdded,
        plansAdded,
        error: msg
      };
    }
  },

  async fulfillOrder(orderId: string): Promise<{ ok: boolean; reference?: string; error?: string; status?: string }> {
    console.log("[fulfillOrder] Starting for order:", orderId);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { network: true, dataPlan: true }
    });

    if (!order) {
      console.error("[fulfillOrder] Order not found:", orderId);
      return { ok: false, error: "Order not found." };
    }

    console.log("[fulfillOrder] Order status:", order.status, "| apiResponsePayload:", order.apiResponsePayload ? "exists" : "null");

    if (order.status === "COMPLETED" && order.apiResponsePayload != null) {
      console.log("[fulfillOrder] Already fulfilled, skipping:", orderId);
      return { ok: true, reference: "Already completed" };
    }

    const config = await getActiveConfig();
    if (!config) {
      console.error("[fulfillOrder] No active API config found");
      return { ok: false, error: "No API configuration. Configure in Settings > API Configuration." };
    }

    // Validate API credentials
    if (!config.apiKey || !config.apiKey.trim()) {
      console.error("[fulfillOrder] API key is missing or empty");
      return { ok: false, error: "API key is missing. Check your API configuration." };
    }

    console.log("[fulfillOrder] Using config:", config.name, "| provider:", config.provider, "| baseUrl:", config.baseUrl);
    console.log("[fulfillOrder] API key present:", Boolean(config.apiKey), "| API secret present:", Boolean(config.apiSecret));

    const endpoints = (config.endpoints ?? {}) as EndpointsConfig;
    // Detect GhBundle API (direct or proxy URLs)
    const isGhBundle = isGhBundleBaseUrl(config.baseUrl);
    const isV1 = isV1Provider(config);
    // Default purchase path: /orders for ghbundle.com, /api/purchase for others
    const purchasePath = isGhBundle
      ? resolveGhBundleEndpoint(endpoints.purchase, "/orders")
      : (endpoints.purchase ?? "/api/purchase");
    const purchaseMethod = endpoints.purchaseMethod ?? "POST"; // Default to POST, but allow GET

    let payload: object;
    let v1PayloadCandidates: V1PurchasePayload[] | null = null;
    if (isGhBundle) {
      // GhBundle API format: {service_id, phone, qty, client_order_id}
      // Try to get service_id from externalOrder if available
      let serviceId: string | null = null;
      const externalOrder = await prisma.agentExternalOrder.findUnique({
        where: { orderId: orderId },
        select: { serviceId: true }
      }).catch(() => null);
      
      if (externalOrder?.serviceId) {
        serviceId = externalOrder.serviceId;
      } else {
        // Try to fetch service_id from GhBundle services API by matching plan
        try {
          const networkName = order.network?.name?.toUpperCase() ?? "";
          const servicesPath = resolveGhBundleEndpoint(endpoints.networks, "/services");
          const queryParam = networkName ? `?network=${encodeURIComponent(networkName)}` : "";
          const fullServicesPath = `${servicesPath}${queryParam}`;
          console.log("[fulfillOrder] Fetching services from:", config.baseUrl + fullServicesPath);
          
          const servicesData = await apiRequest<{ services?: Array<{ service_id?: string; plan_name?: string; volume?: string }>; data?: Array<{ service_id?: string; plan_name?: string; volume?: string }> } | Array<{ service_id?: string; plan_name?: string; volume?: string }>>(
            config.baseUrl,
            fullServicesPath,
            {
              method: "GET",
              apiKey: config.apiKey,
              apiSecret: config.apiSecret ?? undefined
            }
          ).catch((err) => {
            console.warn("[fulfillOrder] Services API lookup failed:", err);
            return null;
          });
          
          const services = Array.isArray(servicesData) ? servicesData : (servicesData?.services ?? servicesData?.data ?? []);
          const planName = order.dataPlan?.name ?? "";
          const planVolume = order.dataPlan?.dataAmount ?? "";
          
          // Match by plan name or volume
          const matchedService = services.find((s: { plan_name?: string; volume?: string; service_id?: string }) => 
            s.service_id && (
              s.plan_name?.toLowerCase() === planName.toLowerCase() ||
              s.volume?.toLowerCase() === planVolume.toLowerCase()
            )
          ) as { service_id?: string } | undefined;
          
          if (matchedService?.service_id) {
            serviceId = matchedService.service_id;
            console.log("[fulfillOrder] Found service_id from GhBundle API:", serviceId);
          }
        } catch (lookupError) {
          console.warn("[fulfillOrder] Failed to lookup service_id from GhBundle:", lookupError);
        }
      }
      
      // Fallback to dataPlanId if service_id not found (might work if GhBundle accepts it)
      if (!serviceId) {
        serviceId = order.dataPlanId;
        console.warn("[fulfillOrder] Using dataPlanId as service_id (may not work):", serviceId);
      }
      
      // Provider recipient format: always local Ghana number starting with 0
      const phone = toLocalGhanaPhone(order.recipientNumber);
      
      payload = {
        service_id: serviceId,
        phone,
        qty: 1,
        client_order_id: order.orderNumber
      };
      console.log("[fulfillOrder] GhBundle payload:", JSON.stringify(payload));
    } else if (isV1) {
      const resolvedNetwork = resolveV1Network(order.network?.name);
      const size = resolveV1PlanSize(resolvedNetwork.name, {
        name: order.dataPlan?.name,
        dataAmount: order.dataPlan?.dataAmount
      });
      const basePayload: V1PurchasePayload = {
        beneficiary_number: toLocalGhanaPhone(order.recipientNumber),
        network_id: resolvedNetwork.apiId,
        size
      };
      const sizeCandidates = buildV1SizeCandidates(size);
      v1PayloadCandidates = (sizeCandidates.length > 0 ? sizeCandidates : [size]).map((candidateSize) => ({
        ...basePayload,
        size: candidateSize
      }));
      payload = v1PayloadCandidates[0];
      console.log("[fulfillOrder] V1 network mapping:", JSON.stringify({
        originalNetwork: order.network?.name ?? null,
        resolvedNetwork: resolvedNetwork.name,
        networkId: resolvedNetwork.apiId,
        originalPlanName: order.dataPlan?.name ?? null,
        originalDataAmount: order.dataPlan?.dataAmount ?? null,
        resolvedSize: size,
        sizeCandidates: v1PayloadCandidates.map((p) => p.size)
      }));
      console.log("[fulfillOrder] V1 payload:", JSON.stringify(payload));
    } else {
      payload = {
        recipientNumber: toLocalGhanaPhone(order.recipientNumber),
        network: order.network?.name ?? "",
        networkId: order.networkId,
        planId: order.dataPlanId,
        planName: order.dataPlan?.name ?? "",
        amount: order.amount,
        orderNumber: order.orderNumber
      };
      console.log("[fulfillOrder] Generic payload:", JSON.stringify(payload));
    }

    console.log("[fulfillOrder] Calling provider API:", config.baseUrl + purchasePath, "Method:", purchaseMethod);

    try {
      const sendPurchaseRequest = async (activePayload: object): Promise<{
        message?: string;
        order?: { reference_id?: number; total?: string; status?: string };
        reference?: string;
        transactionId?: string;
        success?: boolean;
      }> => {
        try {
          return await apiRequest<{
            message?: string;
            order?: { reference_id?: number; total?: string; status?: string };
            reference?: string;
            transactionId?: string;
            success?: boolean;
          }>(
            config.baseUrl,
            purchasePath,
            {
              method: purchaseMethod,
              apiKey: config.apiKey,
              apiSecret: config.apiSecret ?? undefined,
              body: purchaseMethod === "POST" ? activePayload : undefined
            }
          );
        }
        catch (firstError: unknown) {
          if (purchaseMethod === "POST" && (firstError as { status?: number })?.status === 405) {
            console.log("[fulfillOrder] POST returned 405, trying GET with query params");
            const queryParams = new URLSearchParams();
            Object.entries(activePayload).forEach(([key, value]) => {
              queryParams.append(key, String(value));
            });
            const pathWithQuery = `${purchasePath}${purchasePath.includes("?") ? "&" : "?"}${queryParams.toString()}`;
            return apiRequest<{
              message?: string;
              order?: { reference_id?: number; total?: string; status?: string };
              reference?: string;
              transactionId?: string;
              success?: boolean;
            }>(
              config.baseUrl,
              pathWithQuery,
              {
                method: "GET",
                apiKey: config.apiKey,
                apiSecret: config.apiSecret ?? undefined
              }
            );
          }
          throw firstError;
        }
      };

      const attempts: object[] = v1PayloadCandidates != null && v1PayloadCandidates.length > 0
        ? v1PayloadCandidates
        : [payload];
      let result: {
        message?: string;
        order?: { reference_id?: number; total?: string; status?: string };
        reference?: string;
        transactionId?: string;
        success?: boolean;
      } | null = null;

      for (let attemptIndex = 0; attemptIndex < attempts.length; attemptIndex++) {
        payload = attempts[attemptIndex];
        if (attempts.length > 1) {
          console.log(`[fulfillOrder] Provider attempt ${attemptIndex + 1}/${attempts.length}:`, JSON.stringify(payload));
        }

        try {
          result = await sendPurchaseRequest(payload);
        } catch (attemptError) {
          const attemptMsg = parseProviderError(attemptError);
          const shouldRetryVariant = isV1 && isV1SizeVariantUnavailableMessage(attemptMsg) && attemptIndex < attempts.length - 1;
          if (shouldRetryVariant) {
            console.warn(`[fulfillOrder] Variant unavailable, trying next size candidate (${attemptIndex + 2}/${attempts.length})`);
            continue;
          }
          throw attemptError;
        }

        console.log("[fulfillOrder] Provider API response:", JSON.stringify(result));

        const reference =
          extractProviderReference(result) ??
          result.order?.reference_id?.toString() ??
          result.reference ??
          result.transactionId ??
          `EXT-${Date.now()}`;

        const providerState = extractProviderState(result);
        console.log("[fulfillOrder] Provider state:", providerState, "| reference:", reference, "| orderId:", orderId);

        if (providerState === "FAILED") {
          const failedReason = extractProviderMessage(result) ?? "Provider marked this order as failed.";
          const shouldRetryVariant = isV1 && isV1SizeVariantUnavailableMessage(failedReason) && attemptIndex < attempts.length - 1;
          if (shouldRetryVariant) {
            console.warn(`[fulfillOrder] Provider rejected size variant, trying next candidate (${attemptIndex + 2}/${attempts.length})`);
            continue;
          }
          await markOrderFailed(
            orderId,
            failedReason,
            normalizeJsonObject(payload),
            normalizeJsonObject(result)
          );
          return { ok: false, error: failedReason, reference, status: "FAILED" };
        }

        if (providerState === "COMPLETED") {
          await markOrderCompleted(
            orderId,
            normalizeJsonObject(payload),
            normalizeJsonObject(result)
          );
          return { ok: true, reference, status: "COMPLETED" };
        }

        await prisma.order.updateMany({
          where: {
            id: orderId,
            status: { in: ["PENDING", "PROCESSING", "FAILED"] }
          },
          data: {
            status: "PROCESSING",
            paymentStatus: "COMPLETED",
            completedAt: null,
            failedReason: null,
            apiRequestPayload: normalizeJsonObject(payload),
            apiResponsePayload: normalizeJsonObject(result)
          }
        });

        return { ok: true, reference, status: "PROCESSING" };
      }

      const fallbackMessage = isV1
        ? "Selected bundle size is unavailable on provider for this network. Use a plan size that exists in the provider catalog."
        : "Unable to fulfill order with provider.";
      throw new Error(fallbackMessage);
    } catch (err) {
      const friendlyMsg = parseProviderError(err);
      const rawMsg = err instanceof Error ? err.message : "Unknown error";
      console.error("[fulfillOrder] FAILED — orderId:", orderId, "| raw:", rawMsg, "| friendly:", friendlyMsg);

      await markOrderFailed(
        orderId,
        friendlyMsg,
        normalizeJsonObject(payload)
      );

      return { ok: false, error: friendlyMsg, status: "FAILED" };
    }
  },

  async syncOrderStatus(orderId: string): Promise<{ ok: boolean; status?: string; error?: string }> {
    return syncOrderStatusInternal(orderId);
  },

  async syncUserInProgressOrders(userId: string): Promise<void> {
    const processingOrders = await prisma.order.findMany({
      where: {
        userId,
        status: "PROCESSING",
        paymentStatus: "COMPLETED"
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 5
    });

    for (const order of processingOrders) {
      try {
        await syncOrderStatusInternal(order.id);
      } catch (error) {
        console.error("[provider] Failed to sync order status:", order.id, error);
      }
    }
  }
};
