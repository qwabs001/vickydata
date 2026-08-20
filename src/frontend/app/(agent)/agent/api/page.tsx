"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/frontend/hooks/useAuth";

type AgentCredential = {
  id: string;
  name: string | null;
  apiKey: string;
  apiSecret: string;
  status: "ACTIVE" | "DISABLED";
  rateLimitPerMin: number;
  lastUsedAt: string | null;
  lastRequestAt: string | null;
  requestCount: number;
  createdAt: string;
};

const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://vickydata.com").replace(/\/$/, "");
const BASE_URL = `${APP_URL}/api/v1`;

export default function AgentApiPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<AgentCredential[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    setLoading(true);
    setError(null);

    fetch("/api/agent/credentials", {
      headers: { "x-user-id": user.id }
    })
      .then((response) => response.json().catch(() => null).then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          setError(data?.error ?? "Unable to load API credentials.");
          setCredentials([]);
          return;
        }
        const rows = Array.isArray(data?.credentials) ? data.credentials : [];
        setCredentials(rows as AgentCredential[]);
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load API credentials.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const primaryKey = useMemo(() => credentials.find((row) => row.status === "ACTIVE"), [credentials]);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

  const toggleSecret = (id: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
      <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6">
        <h1 className="text-2xl font-black text-slate-900">Reseller API</h1>
        <p className="mt-2 text-sm text-slate-500">
          Connect your own website or app to VickyData services, wallet balance, and live order status updates.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-bold text-slate-900">Connection Details</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">Base URL:</span>{" "}
              <code className="break-all">{BASE_URL}</code>
            </p>
            <p>
              <span className="font-semibold text-slate-900">Auth:</span>{" "}
              <code>X-API-KEY: your_key</code> or <code>Authorization: Bearer your_key</code>
            </p>
            <p>
              <span className="font-semibold text-slate-900">Rate Limit:</span>{" "}
              {primaryKey ? `${primaryKey.rateLimitPerMin} requests/min` : "Set by admin"}
            </p>
            <div className="rounded-xl border border-slate-200 bg-[#ecfdf3] p-3 text-xs leading-6 text-slate-700">
              Simple auth — no signing, no IP restrictions. Works from anywhere.
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
            <a
              href="/docs/reseller-api/openapi.yaml"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-700"
            >
              OpenAPI
            </a>
            <a
              href="/docs/reseller-api/postman_collection.json"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-700"
            >
              Postman Collection
            </a>
            <a
              href="/docs/reseller-api/README.md"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-700"
            >
              Integration Guide
            </a>
            <a
              href="/docs/reseller-api/quick-start.md"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-700"
            >
              Quick Start
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-bold text-slate-900">Quick Example (curl)</h2>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-[#0f172a] p-4 text-xs leading-5 text-slate-100 whitespace-pre-wrap break-words sm:whitespace-pre">
{`# Fetch balance
curl "${BASE_URL}/balance" \\
  -H "X-API-KEY: your_api_key"

# Fetch services
curl "${BASE_URL}/services" \\
  -H "X-API-KEY: your_api_key"`}
          </pre>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-bold text-slate-900">Your API Keys</h2>
        <p className="text-sm text-slate-500">Keep your API key and secret private. Regenerate if you think they were exposed.</p>
        <div className="mt-4 grid gap-3 md:hidden">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-6 text-center text-sm text-slate-500">
              Loading credentials...
            </div>
          ) : credentials.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-6 text-center text-sm text-slate-500">
              No API key yet. Ask admin to generate one for your account.
            </div>
          ) : (
            credentials.map((credential) => (
              <article key={credential.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{credential.name ?? "Default Key"}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">{credential.apiKey}</p>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">API Secret</p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="break-all text-xs text-slate-700">
                        {revealedSecrets.has(credential.id)
                          ? credential.apiSecret || "—"
                          : credential.apiSecret
                            ? "••••••••••••••••••••"
                            : "Unavailable"}
                      </code>
                      {credential.apiSecret ? (
                        <button
                          type="button"
                          onClick={() => toggleSecret(credential.id)}
                          className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={revealedSecrets.has(credential.id) ? "Hide secret" : "Show secret"}
                        >
                          {revealedSecrets.has(credential.id) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      credential.status === "ACTIVE"
                        ? "bg-[#ecfdf3] text-[#16a34a]"
                        : "bg-[#fee2e2] text-[#ef4444]"
                    }`}
                  >
                    {credential.status}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <dt>Rate Limit</dt>
                    <dd className="font-semibold text-slate-800">{credential.rateLimitPerMin}/min</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Last Request</dt>
                    <dd className="text-right font-semibold text-slate-800">{formatDateTime(credential.lastRequestAt)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Total Requests</dt>
                    <dd className="font-semibold text-slate-800">{credential.requestCount.toLocaleString()}</dd>
                  </div>
                </dl>
              </article>
            ))
          )}
        </div>
        <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-slate-100 md:block">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-left">Credentials</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Rate Limit</th>
                <th className="px-4 py-3 text-left">Last Request</th>
                <th className="px-4 py-3 text-left">Total Requests</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading credentials...</td>
                </tr>
              ) : credentials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No API key yet. Ask admin to generate one for your account.
                  </td>
                </tr>
              ) : (
                credentials.map((credential) => (
                  <tr key={credential.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-800">{credential.name ?? "Default Key"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="space-y-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">API Key</p>
                          <code className="mt-1 block max-w-[28rem] break-all text-xs leading-5 text-slate-700">
                            {credential.apiKey}
                          </code>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">API Secret</p>
                          <div className="mt-1 flex items-center gap-2">
                            <code className="max-w-[28rem] break-all text-xs leading-5 text-slate-700">
                              {revealedSecrets.has(credential.id)
                                ? credential.apiSecret || "—"
                                : credential.apiSecret
                                  ? "••••••••••••••••••••"
                                  : "Unavailable"}
                            </code>
                            {credential.apiSecret ? (
                              <button
                                type="button"
                                onClick={() => toggleSecret(credential.id)}
                                className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                aria-label={revealedSecrets.has(credential.id) ? "Hide secret" : "Show secret"}
                              >
                                {revealedSecrets.has(credential.id) ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          credential.status === "ACTIVE"
                            ? "bg-[#ecfdf3] text-[#16a34a]"
                            : "bg-[#fee2e2] text-[#ef4444]"
                        }`}
                      >
                        {credential.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{credential.rateLimitPerMin}/min</td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(credential.lastRequestAt)}</td>
                    <td className="px-4 py-3 text-slate-700">{credential.requestCount.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })} ${date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}
