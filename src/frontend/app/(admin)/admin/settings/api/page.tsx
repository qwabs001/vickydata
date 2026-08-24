"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/frontend/hooks/useAuth";

type ApiConfig = {
  id: string;
  provider: string;
  name: string;
  baseUrl: string;
  hasApiKey: boolean;
  endpoints?: Partial<ApiEndpoints>;
  isActive: boolean;
};

type ApiEndpoints = {
  networks: string;
  plans: string;
  purchase: string;
  test: string;
  status: string;
  purchaseMethod: "GET" | "POST";
};

type ServiceStatus = {
  ok: boolean;
  message: string;
  latencyMs?: number;
};

const EMPTY_ENDPOINTS: ApiEndpoints = {
  networks: "",
  plans: "",
  purchase: "",
  test: "",
  status: "",
  purchaseMethod: "POST"
};
const GENERIC_LEGACY_ENDPOINTS = new Set([
  "",
  "/",
  "/normal-orders",
  "/orders",
  "/purchase",
  "/data-orders",
  "/services",
  "/balance",
  "/me",
  "/profile",
  "/api/networks",
  "/api/plans",
  "/api/purchase"
]);

function isGhBundleUrl(url: string): boolean {
  return /ghbundle\.com|ghbundle-reseller-api-proxy/i.test(url);
}

function isJaybartUrl(url: string): boolean {
  return /jaybartservices\.com/i.test(url);
}

function isDataFraternityUrl(url: string): boolean {
  return /datafraternity\.com/i.test(url);
}

function isResellerV1Url(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /(^|\.)bundlearena\.com$/i.test(parsed.hostname) && /\/api\/v1\/?$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function getProviderDefaults(baseUrl: string) {
  if (isResellerV1Url(baseUrl)) {
    return {
      provider: "reseller-v1",
      name: "BundleArena Reseller API",
      endpoints: {
        test: "/services",
        networks: "/services",
        plans: "/services",
        purchase: "/orders",
        status: "/orders/{reference}",
        purchaseMethod: "POST" as const
      }
    };
  }

  if (isDataFraternityUrl(baseUrl)) {
    return {
      provider: "datafraternity",
      name: "DataFraternity API",
      endpoints: {
        test: "/wallet",
        networks: "/special-offers",
        plans: "/special-offers",
        purchase: "/special-offers/orders",
        status: "/special-offers/orders/{reference}",
        purchaseMethod: "POST" as const
      }
    };
  }

  if (isGhBundleUrl(baseUrl)) {
    return {
      provider: "ghbundle",
      name: "GhBundle API",
      endpoints: {
        test: "/balance",
        networks: "/services",
        plans: "/services",
        purchase: "/orders",
        status: "/orders/{reference}",
        purchaseMethod: "POST" as const
      }
    };
  }

  if (isJaybartUrl(baseUrl)) {
    return {
      provider: "jaybart",
      name: "Jaybart API",
      endpoints: {
        networks: "/fetch-networks",
        plans: "/fetch-data-packages",
        purchase: "/buy-other-package",
        test: "/check-console-balance",
        status: "/fetch-other-network-transaction",
        purchaseMethod: "POST" as const
      }
    };
  }

  return {
    provider: "v1",
    name: "Data Provider API",
    endpoints: {
      ...EMPTY_ENDPOINTS,
      test: "/normal-orders",
      purchase: "/normal-orders",
      purchaseMethod: "POST" as const
    }
  };
}

function normalizeEndpointValue(baseUrl: string, value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return fallback;
  if ((isJaybartUrl(baseUrl) || isResellerV1Url(baseUrl)) && GENERIC_LEGACY_ENDPOINTS.has(trimmed.toLowerCase())) {
    return fallback;
  }
  return trimmed;
}

function mergeEndpointInputs(baseUrl: string, input: ApiEndpoints): ApiEndpoints {
  const defaults = getProviderDefaults(baseUrl).endpoints;
  return {
    networks: normalizeEndpointValue(baseUrl, input.networks, defaults.networks || ""),
    plans: normalizeEndpointValue(baseUrl, input.plans, defaults.plans || ""),
    purchase: normalizeEndpointValue(baseUrl, input.purchase, defaults.purchase || ""),
    test: normalizeEndpointValue(baseUrl, input.test, defaults.test || ""),
    status: normalizeEndpointValue(baseUrl, input.status, defaults.status || ""),
    purchaseMethod: input.purchaseMethod
  };
}

function toEndpointPayload(endpoints: ApiEndpoints) {
  return {
    ...(endpoints.networks ? { networks: endpoints.networks } : {}),
    ...(endpoints.plans ? { plans: endpoints.plans } : {}),
    ...(endpoints.purchase ? { purchase: endpoints.purchase } : {}),
    ...(endpoints.test ? { test: endpoints.test } : {}),
    ...(endpoints.status ? { status: endpoints.status } : {}),
    purchaseMethod: endpoints.purchaseMethod
  };
}

export default function Page() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://ghbundle.com/api/v1");
  const [endpoints, setEndpoints] = useState<ApiEndpoints>(getProviderDefaults("https://ghbundle.com/api/v1").endpoints);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const connected = configs.length > 0;
  const activeConfig = configs.find((c) => c.isActive);
  const ghBundleMode = isGhBundleUrl(baseUrl);
  const jaybartMode = isJaybartUrl(baseUrl);
  const dataFraternityMode = isDataFraternityUrl(baseUrl);
  const statusLabel = !activeConfig
    ? "Not Connected"
    : serviceStatus?.ok === true
      ? "Connected"
      : serviceStatus?.ok === false
        ? "Needs Attention"
        : "Configured";
  const statusDotClass = !activeConfig
    ? "bg-slate-300"
    : serviceStatus?.ok === true
      ? "bg-emerald-500"
      : serviceStatus?.ok === false
        ? "bg-red-500"
        : activeConfig.isActive
          ? "bg-amber-500"
          : "bg-slate-300";

  const loadConfigs = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/api-config", {
        headers: { "x-user-id": user.id }
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setError(typeof data?.error === "string" ? data.error : "Database temporarily unavailable. Please try again in a moment.");
        setConfigs([]);
        return;
      }
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Unable to load API configs.");
        setConfigs([]);
        return;
      }
      setConfigs(Array.isArray(data) ? data : []);
    } catch {
      setError("Unable to load API configs.");
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, [user?.id]);

  useEffect(() => {
    if (activeConfig?.baseUrl) {
      const defaults = getProviderDefaults(activeConfig.baseUrl).endpoints;
      setBaseUrl(activeConfig.baseUrl);
      setEndpoints({
        ...EMPTY_ENDPOINTS,
        ...defaults,
        networks: normalizeEndpointValue(activeConfig.baseUrl, activeConfig.endpoints?.networks, defaults.networks || ""),
        plans: normalizeEndpointValue(activeConfig.baseUrl, activeConfig.endpoints?.plans, defaults.plans || ""),
        purchase: normalizeEndpointValue(activeConfig.baseUrl, activeConfig.endpoints?.purchase, defaults.purchase || ""),
        test: normalizeEndpointValue(activeConfig.baseUrl, activeConfig.endpoints?.test, defaults.test || ""),
        status: normalizeEndpointValue(activeConfig.baseUrl, activeConfig.endpoints?.status, defaults.status || ""),
        purchaseMethod:
          activeConfig.endpoints?.purchaseMethod === "GET" || activeConfig.endpoints?.purchaseMethod === "POST"
            ? activeConfig.endpoints.purchaseMethod
            : defaults.purchaseMethod
      });
    }
  }, [activeConfig]);

  useEffect(() => {
    if (activeConfig || connected) return;
    setEndpoints(getProviderDefaults(baseUrl).endpoints);
  }, [activeConfig, baseUrl, connected]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setError(null);
    window.setTimeout(() => setNotice(null), 4000);
  };

  const handleConnect = async () => {
    if (!user?.id || !apiKey.trim()) {
      setError("Enter your API token.");
      return;
    }
    const resolvedBaseUrl = baseUrl.trim();
    if (!resolvedBaseUrl) {
      setError("Base URL is required.");
      return;
    }
    try {
      new URL(resolvedBaseUrl);
    } catch {
      setError("Enter a valid Base URL (e.g. https://ghbundle.com/api/v1).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = apiKey.trim();
      const secret = apiSecret.trim();
      const defaults = getProviderDefaults(resolvedBaseUrl);
      const resolvedEndpoints = mergeEndpointInputs(resolvedBaseUrl, endpoints);
      const payload = {
        provider: defaults.provider,
        name: defaults.name,
        apiKey: token,
        apiSecret: secret,
        baseUrl: resolvedBaseUrl,
        endpoints: toEndpointPayload(resolvedEndpoints)
      };
      const existing =
        configs.find((c) => c.provider === payload.provider) ??
        configs.find((c) => c.isActive) ??
        configs[0];
      const res = existing
        ? await fetch(`/api/admin/settings/api-config/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": user.id },
            body: JSON.stringify({
              provider: payload.provider,
              name: payload.name,
              apiKey: token,
              apiSecret: secret,
              baseUrl: resolvedBaseUrl,
              endpoints: payload.endpoints
            })
          })
        : await fetch("/api/admin/settings/api-config", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": user.id },
            body: JSON.stringify(payload)
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Unable to connect.");
        return;
      }
      showNotice("API connected successfully. You can now sync and fulfill orders.");
      setApiKey("");
      setApiSecret("");
      setEndpoints(resolvedEndpoints);
      loadConfigs();
    } catch {
      setError("Unable to connect.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (configId: string) => {
    if (!user?.id) return;
    setTesting(true);
    setError(null);
    setServiceStatus(null);
    const start = Date.now();
    try {
      const res = await fetch("/api/admin/settings/api-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ configId })
      });
      const data = await res.json().catch(() => ({}));
      const latencyMs = Date.now() - start;
      if (data.ok) {
        setServiceStatus({ ok: true, message: "Connection healthy", latencyMs });
        showNotice("Connection test passed.");
      } else {
        setServiceStatus({ ok: false, message: data?.message ?? "Connection failed" });
        setError(data?.message ?? "Connection failed.");
      }
    } catch {
      setServiceStatus({ ok: false, message: "Connection failed" });
      setError("Test failed.");
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async (configId: string) => {
    if (!user?.id) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/api-config/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ configId })
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        showNotice(`Synced: ${data.networksAdded ?? 0} networks, ${data.plansAdded ?? 0} plans imported.`);
        if (data.error) setError(data.error);
      } else {
        setError(data?.error ?? "Sync failed.");
      }
    } catch {
      setError("Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleActive = async (config: ApiConfig) => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/admin/settings/api-config/${config.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ isActive: !config.isActive })
      });
      if (res.ok) {
        showNotice(config.isActive ? "API disabled." : "API enabled.");
        loadConfigs();
      }
    } catch {
      setError("Unable to update.");
    }
  };

  const handleDisconnect = async (config: ApiConfig) => {
    if (!user?.id) return;
    if (!confirm("Disconnect this API? Orders will no longer auto-fulfill.")) return;
    try {
      const res = await fetch(`/api/admin/settings/api-config/${config.id}`, {
        method: "DELETE",
        headers: { "x-user-id": user.id }
      });
      if (res.ok) {
        showNotice("API disconnected.");
        setServiceStatus(null);
        loadConfigs();
      }
    } catch {
      setError("Unable to disconnect.");
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-black text-[#0f172a]">API Configuration</h1>
        <p className="text-sm text-slate-500">
          Connect your data provider API to import services and auto-fulfill orders.
        </p>
      </header>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex flex-wrap items-center justify-between gap-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadConfigs()}
            disabled={loading}
            className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Retry"}
          </button>
        </div>
      ) : null}

      {/* ── Status + Quick Actions ── */}
      {connected && activeConfig ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Status</p>
            <div className="mt-3 flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${statusDotClass}`} />
              <span className="text-lg font-bold text-slate-900">{statusLabel}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Service Health</p>
            <div className="mt-3">
              {serviceStatus ? (
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${serviceStatus.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span className={`text-sm font-semibold ${serviceStatus.ok ? "text-emerald-700" : "text-red-600"}`}>
                    {serviceStatus.message}
                  </span>
                  {serviceStatus.latencyMs ? (
                    <span className="text-xs text-slate-400">{serviceStatus.latencyMs}ms</span>
                  ) : null}
                </div>
              ) : (
                <span className="text-sm text-slate-500">Click &quot;Test&quot; to check</span>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Quick Actions</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-[#2563eb] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                onClick={() => handleTest(activeConfig.id)}
                disabled={testing}
              >
                {testing ? "Testing..." : "Test"}
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60"
                onClick={() => handleSync(activeConfig.id)}
                disabled={syncing}
              >
                {syncing ? "Syncing..." : "Sync Services"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Connect / Update ── */}
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-bold text-[#0f172a]">{connected ? "Update API Credentials" : "Connect API"}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter your data provider&apos;s Base URL and API Token to start importing services.
          </p>
          <div className="mt-6 space-y-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                API Base URL
              </label>
              <input
                type="url"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
                placeholder="https://ghbundle.com/api/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400">The base URL of your provider&apos;s API</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                API Token
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type={showToken ? "text" : "password"}
                  className="flex-1 rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
                  placeholder="Your API token (e.g. 4|Ko7j0xd...)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-3 text-xs text-slate-500 hover:bg-slate-50"
                  onClick={() => setShowToken(!showToken)}
                  title={showToken ? "Hide" : "Show"}
                >
                  {showToken ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">Paste your provider token (include a prefix like &quot;Token&quot; or &quot;Bearer&quot; if required).</p>
              {ghBundleMode ? (
                <p className="mt-1 text-xs text-[#2563eb]">GhBundle uses token auth. A valid API token is enough.</p>
              ) : null}
              {jaybartMode ? (
                <p className="mt-1 text-xs text-[#2563eb]">Jaybart uses the `x-api-key` header with the raw API key.</p>
              ) : null}
              {dataFraternityMode ? (
                <p className="mt-1 text-xs text-[#2563eb]">DataFraternity uses the raw API key in the `X-API-Key` header.</p>
              ) : null}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                API Secret (Optional)
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type={showSecret ? "text" : "password"}
                  className="flex-1 rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
                  placeholder="Custom signing secret"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-3 text-xs text-slate-500 hover:bg-slate-50"
                  onClick={() => setShowSecret(!showSecret)}
                  title={showSecret ? "Hide" : "Show"}
                >
                  {showSecret ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    const bytes = new Uint8Array(24);
                    window.crypto.getRandomValues(bytes);
                    const generated = Array.from(bytes)
                      .map((b) => b.toString(16).padStart(2, "0"))
                      .join("");
                    setApiSecret(generated);
                    setShowSecret(true);
                  }}
                >
                  Generate
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {ghBundleMode
                  ? "Leave this empty for GhBundle. Separate signing headers are not used for GhBundle API requests."
                  : "Leave empty to reuse API token as secret. Use this if your provider requires a separate signing secret."}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Custom Endpoints</p>
                  <p className="mt-1 text-xs text-slate-400">Leave fields empty to use the provider preset. Jaybart usually needs these set explicitly.</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">
                  {endpoints.purchaseMethod}
                </span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Test Endpoint</label>
                  <input
                    type="text"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
                    placeholder={getProviderDefaults(baseUrl).endpoints.test || "/balance"}
                    value={endpoints.test}
                    onChange={(e) => setEndpoints((prev) => ({ ...prev, test: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Purchase Endpoint</label>
                  <input
                    type="text"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
                    placeholder={getProviderDefaults(baseUrl).endpoints.purchase || "/orders"}
                    value={endpoints.purchase}
                    onChange={(e) => setEndpoints((prev) => ({ ...prev, purchase: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Status Endpoint</label>
                  <input
                    type="text"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
                    placeholder={getProviderDefaults(baseUrl).endpoints.status || "/orders/{reference}"}
                    value={endpoints.status}
                    onChange={(e) => setEndpoints((prev) => ({ ...prev, status: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Purchase Method</label>
                  <select
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
                    value={endpoints.purchaseMethod}
                    onChange={(e) => setEndpoints((prev) => ({ ...prev, purchaseMethod: e.target.value as ApiEndpoints["purchaseMethod"] }))}
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Networks Endpoint</label>
                  <input
                    type="text"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
                    placeholder={getProviderDefaults(baseUrl).endpoints.networks || "/services"}
                    value={endpoints.networks}
                    onChange={(e) => setEndpoints((prev) => ({ ...prev, networks: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Plans Endpoint</label>
                  <input
                    type="text"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
                    placeholder={getProviderDefaults(baseUrl).endpoints.plans || "/plans/{networkId}"}
                    value={endpoints.plans}
                    onChange={(e) => setEndpoints((prev) => ({ ...prev, plans: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              className="w-full rounded-xl bg-[#2563eb] py-3 text-sm font-semibold text-white disabled:opacity-60"
              onClick={handleConnect}
              disabled={saving || !apiKey.trim()}
            >
              {saving ? "Connecting..." : connected ? "Update Credentials" : "Connect"}
            </button>
          </div>
        </section>

        {/* ── Connected APIs ── */}
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-bold text-[#0f172a]">Connected Providers</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage your connected API integrations.
          </p>
          <div className="mt-6 space-y-4">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
            ) : configs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-[#f8fafc] p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-medium text-slate-600">No API connected</p>
                <p className="mt-1 text-xs text-slate-400">Enter your credentials on the left to get started.</p>
              </div>
            ) : (
              configs.map((config) => (
                <div
                  key={config.id}
                  className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.isActive ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"}`}>
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{config.name}</p>
                        <p className="text-xs text-slate-500">{config.baseUrl}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(config)}
                      className={`relative h-6 w-11 rounded-full transition ${config.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${config.isActive ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-[#2563eb] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      onClick={() => handleTest(config.id)}
                      disabled={testing}
                    >
                      {testing ? "Testing..." : "Test Connection"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60"
                      onClick={() => handleSync(config.id)}
                      disabled={syncing}
                    >
                      {syncing ? "Importing..." : "Import Services"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-600"
                      onClick={() => handleDisconnect(config)}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── How it works ── */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
            <h3 className="text-sm font-bold text-slate-700">How it works</h3>
            <ol className="mt-3 space-y-2 text-xs text-slate-500">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[10px] font-bold text-white">1</span>
                <span>Enter your provider&apos;s <strong>Base URL</strong> and <strong>API Token</strong> and connect.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[10px] font-bold text-white">2</span>
                <span><strong>Test Connection</strong> to verify your credentials are working.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[10px] font-bold text-white">3</span>
                <span><strong>Import Services</strong> to pull networks &amp; plans into your catalog.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[10px] font-bold text-white">4</span>
                <span>Orders will auto-fulfill via the API when payment is confirmed.</span>
              </li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
