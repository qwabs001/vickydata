"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/frontend/hooks/useAuth";
import { formatCurrency } from "@/shared/utils/formatters";

type UserRow = {
  id: string;
  username: string;
  phoneNumber: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  createdAt: string;
  ordersCount: number;
  ordersTotalAmount: number;
  rewardsBalance: number;
  walletBalance: number;
};

type CredentialRow = {
  id: string;
  agent_id: string;
  agent_name: string;
  api_key: string;
  name: string | null;
  status: "ACTIVE" | "DISABLED";
  rate_limit_per_min: number;
  ip_allowlist: string[];
  last_used_at: string | null;
  last_request_at: string | null;
  request_count: number;
  created_at: string;
};

type LogRow = {
  id: string;
  agentId: string;
  agentName: string;
  apiKey: string | null;
  credentialName: string | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number | null;
  ipAddress: string | null;
  errorCode: string | null;
  createdAt: string;
};

type CreateAgentForm = {
  username: string;
  phoneNumber: string;
  password: string;
  status: "ACTIVE" | "SUSPENDED";
  initialBalance: string;
  generateApiCredentials: boolean;
  credentialName: string;
};

type WalletActionForm = {
  agentId: string;
  action: "credit" | "debit";
  amount: string;
  reason: string;
};

const defaultCreateAgentForm: CreateAgentForm = {
  username: "",
  phoneNumber: "",
  password: "",
  status: "ACTIVE",
  initialBalance: "0",
  generateApiCredentials: true,
  credentialName: "Primary Key"
};

export default function AdminAgentsPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [discountPercent, setDiscountPercent] = useState(0);
  const [agents, setAgents] = useState<UserRow[]>([]);
  const [customers, setCustomers] = useState<UserRow[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const [createAgentForm, setCreateAgentForm] = useState<CreateAgentForm>(defaultCreateAgentForm);

  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [selectedCredentialAgentId, setSelectedCredentialAgentId] = useState("");
  const [credentialName, setCredentialName] = useState("Primary Key");
  const [credentialRateLimit, setCredentialRateLimit] = useState("60");
  const [credentialIpAllowlist, setCredentialIpAllowlist] = useState("");
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [showGeneratedSecret, setShowGeneratedSecret] = useState(false);

  const [walletForm, setWalletForm] = useState<WalletActionForm>({
    agentId: "",
    action: "credit",
    amount: "",
    reason: ""
  });

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedLogsAgentId, setSelectedLogsAgentId] = useState("");

  const withAdminHeaders = (extra?: HeadersInit) => ({
    ...(extra ?? {}),
    ...(user?.id ? { "x-user-id": user.id } : {})
  });

  const loadBaseData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [pricingRes, agentsRes, customersRes, credentialsRes] = await Promise.all([
        fetch("/api/admin/agents/pricing", {
          headers: withAdminHeaders()
        }),
        fetch("/api/users?role=AGENT", {
          headers: withAdminHeaders()
        }),
        fetch("/api/users?role=CUSTOMER", {
          headers: withAdminHeaders()
        }),
        fetch("/api/admin/agents/credentials", {
          headers: withAdminHeaders()
        })
      ]);

      const pricingData = await pricingRes.json().catch(() => null);
      const agentsData = await agentsRes.json().catch(() => null);
      const customersData = await customersRes.json().catch(() => null);
      const credentialsData = await credentialsRes.json().catch(() => null);

      if (!pricingRes.ok) {
        setError(pricingData?.error ?? "Unable to load agent pricing settings.");
      } else {
        setDiscountPercent(Number(pricingData?.discountPercent ?? 0));
      }

      if (!agentsRes.ok) {
        setError(agentsData?.error ?? "Unable to load agents.");
      } else {
        const loadedAgents = Array.isArray(agentsData?.users) ? (agentsData.users as UserRow[]) : [];
        setAgents(loadedAgents);
        setWalletForm((prev) => ({
          ...prev,
          agentId: prev.agentId || loadedAgents[0]?.id || ""
        }));
        setSelectedCredentialAgentId((prev) => prev || loadedAgents[0]?.id || "");
      }

      if (!customersRes.ok) {
        setError(customersData?.error ?? "Unable to load customers.");
      } else {
        setCustomers(Array.isArray(customersData?.users) ? customersData.users : []);
      }

      if (!credentialsRes.ok) {
        setError(credentialsData?.error ?? "Unable to load API credentials.");
      } else {
        setCredentials(Array.isArray(credentialsData?.credentials) ? credentialsData.credentials : []);
      }
    } catch {
      setError("Unable to load agents page.");
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (agentId?: string) => {
    if (!user?.id) return;
    setLogsLoading(true);
    try {
      const qs = new URLSearchParams({ page: "1", limit: "30" });
      if (agentId) qs.set("agentId", agentId);
      const response = await fetch(`/api/admin/agents/logs?${qs.toString()}`, {
        headers: withAdminHeaders()
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to load API logs.");
        setLogs([]);
        return;
      }
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch {
      setError("Unable to load API logs.");
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadBaseData();
  }, [user?.id]);

  useEffect(() => {
    loadLogs(selectedLogsAgentId || undefined);
  }, [user?.id, selectedLogsAgentId]);

  const stats = useMemo(() => {
    const totalSales = agents.reduce((sum, row) => sum + Number(row.ordersTotalAmount ?? 0), 0);
    const totalOrders = agents.reduce((sum, row) => sum + Number(row.ordersCount ?? 0), 0);
    const activeAgents = agents.filter((row) => row.status === "ACTIVE").length;

    return {
      totalAgents: agents.length,
      activeAgents,
      totalOrders,
      totalSales
    };
  }, [agents]);

  const lastRequestByAgent = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const credential of credentials) {
      const existing = map.get(credential.agent_id);
      if (!existing) {
        map.set(credential.agent_id, credential.last_request_at);
        continue;
      }
      if (credential.last_request_at && credential.last_request_at > existing) {
        map.set(credential.agent_id, credential.last_request_at);
      }
    }
    return map;
  }, [credentials]);

  const filteredCredentials = useMemo(() => {
    if (!selectedCredentialAgentId) return credentials;
    return credentials.filter((row) => row.agent_id === selectedCredentialAgentId);
  }, [credentials, selectedCredentialAgentId]);

  const savePricing = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/admin/agents/pricing", {
        method: "PUT",
        headers: withAdminHeaders({
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({ discountPercent: Number(discountPercent) })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to save pricing.");
        return;
      }
      setDiscountPercent(Number(data?.discountPercent ?? 0));
      setSuccess("Agent pricing updated.");
    } catch {
      setError("Unable to save pricing.");
    } finally {
      setSaving(false);
    }
  };

  const promoteSelectedCustomer = async () => {
    if (!user?.id || !selectedCustomerId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/users/${selectedCustomerId}`, {
        method: "PATCH",
        headers: withAdminHeaders({
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({ role: "AGENT" })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to promote customer.");
        return;
      }
      setSelectedCustomerId("");
      setSuccess("Customer promoted to agent.");
      await loadBaseData();
    } catch {
      setError("Unable to promote customer.");
    } finally {
      setSaving(false);
    }
  };

  const createAgent = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setGeneratedSecret(null);
    setShowGeneratedSecret(false);
    try {
      const response = await fetch("/api/admin/agents", {
        method: "POST",
        headers: withAdminHeaders({
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({
          username: createAgentForm.username,
          phoneNumber: createAgentForm.phoneNumber,
          password: createAgentForm.password,
          status: createAgentForm.status,
          initialBalance: Number(createAgentForm.initialBalance || "0"),
          generateApiCredentials: createAgentForm.generateApiCredentials,
          credentialName: createAgentForm.credentialName || undefined
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to create agent.");
        return;
      }

      if (data?.credential?.api_secret) {
        setGeneratedSecret(data.credential.api_secret);
        setShowGeneratedSecret(false);
      }

      setCreateAgentForm(defaultCreateAgentForm);
      setSuccess("Agent account created.");
      await loadBaseData();
    } catch {
      setError("Unable to create agent.");
    } finally {
      setSaving(false);
    }
  };

  const demoteAgent = async (id: string) => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: withAdminHeaders({
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({ role: "CUSTOMER" })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to demote agent.");
        return;
      }
      setSuccess("Agent demoted to customer.");
      await loadBaseData();
    } catch {
      setError("Unable to demote agent.");
    } finally {
      setSaving(false);
    }
  };

  const createCredential = async () => {
    if (!user?.id || !selectedCredentialAgentId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setGeneratedSecret(null);
    setShowGeneratedSecret(false);
    try {
      const response = await fetch("/api/admin/agents/credentials", {
        method: "POST",
        headers: withAdminHeaders({
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({
          agentId: selectedCredentialAgentId,
          name: credentialName || undefined,
          rateLimitPerMin: Number(credentialRateLimit || "60"),
          ipAllowlist: credentialIpAllowlist
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to create API credential.");
        return;
      }
      setGeneratedSecret(data?.credential?.api_secret ?? null);
      setShowGeneratedSecret(false);
      setSuccess("API credential created.");
      await loadBaseData();
      await loadLogs(selectedLogsAgentId || undefined);
    } catch {
      setError("Unable to create API credential.");
    } finally {
      setSaving(false);
    }
  };

  const patchCredential = async (
    credentialId: string,
    payload: Partial<{
      status: "ACTIVE" | "DISABLED";
      name: string;
      rateLimitPerMin: number;
    }>
  ) => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/agents/credentials/${credentialId}`, {
        method: "PATCH",
        headers: withAdminHeaders({
          "Content-Type": "application/json"
        }),
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to update credential.");
        return;
      }
      setSuccess("Credential updated.");
      await loadBaseData();
    } catch {
      setError("Unable to update credential.");
    } finally {
      setSaving(false);
    }
  };

  const rotateCredentialSecret = async (credentialId: string) => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setGeneratedSecret(null);
    setShowGeneratedSecret(false);
    try {
      const response = await fetch(`/api/admin/agents/credentials/${credentialId}/rotate`, {
        method: "POST",
        headers: withAdminHeaders()
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to rotate credential secret.");
        return;
      }
      setGeneratedSecret(data?.api_secret ?? null);
      setShowGeneratedSecret(false);
      setSuccess("Credential secret rotated.");
      await loadBaseData();
    } catch {
      setError("Unable to rotate credential secret.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCredential = async (credentialId: string) => {
    if (!user?.id) return;
    const confirmed = window.confirm("Delete this API credential? This action cannot be undone.");
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/agents/credentials/${credentialId}`, {
        method: "DELETE",
        headers: withAdminHeaders()
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to delete credential.");
        return;
      }
      setSuccess("Credential deleted.");
      await loadBaseData();
      await loadLogs(selectedLogsAgentId || undefined);
    } catch {
      setError("Unable to delete credential.");
    } finally {
      setSaving(false);
    }
  };

  const submitWalletAction = async () => {
    if (!user?.id || !walletForm.agentId) return;
    const amount = Number(walletForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid wallet amount.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/users/${walletForm.agentId}/wallet`, {
        method: "POST",
        headers: withAdminHeaders({
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({
          action: walletForm.action,
          amount,
          reason: walletForm.reason || undefined
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to update wallet.");
        return;
      }
      setSuccess("Wallet updated successfully.");
      setWalletForm((prev) => ({ ...prev, amount: "", reason: "" }));
      await loadBaseData();
    } catch {
      setError("Unable to update wallet.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-black text-[#0f172a]">Agents</h1>
        <p className="text-sm text-slate-500">Manage agent pricing, API credentials, wallet actions, and request activity.</p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}
      {generatedSecret ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">API secret (shown once):</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="break-all text-xs">
              {showGeneratedSecret ? generatedSecret : "••••••••••••••••••••"}
            </code>
            <button
              type="button"
              onClick={() => setShowGeneratedSecret((v) => !v)}
              className="shrink-0 rounded p-1 text-amber-600 hover:bg-amber-100"
              aria-label={showGeneratedSecret ? "Hide secret" : "Show secret"}
            >
              {showGeneratedSecret ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Agents" value={String(stats.totalAgents)} />
        <StatCard label="Active Agents" value={String(stats.activeAgents)} />
        <StatCard label="Agent Orders" value={String(stats.totalOrders)} />
        <StatCard label="Agent Sales" value={formatCurrency(stats.totalSales, "GHS")} />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0f172a]">Agent Pricing</h2>
          <p className="mt-1 text-sm text-slate-500">Global discount applied to agent plan prices.</p>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Discount Percent
            <input
              type="number"
              min={0}
              max={95}
              step={0.5}
              value={discountPercent}
              onChange={(event) => setDiscountPercent(Number(event.target.value))}
              className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={savePricing}
            disabled={saving}
            className="mt-4 w-full rounded-xl bg-[#0f172a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Pricing"}
          </button>
          <p className="mt-3 text-xs text-slate-500">Current multiplier: {(1 - discountPercent / 100).toFixed(2)}x customer price.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0f172a]">Promote Customer</h2>
          <p className="mt-1 text-sm text-slate-500">Convert an existing customer account into agent role.</p>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Customer Account
            <select
              value={selectedCustomerId}
              onChange={(event) => setSelectedCustomerId(event.target.value)}
              className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="">Select customer</option>
              {customers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.username} ({row.phoneNumber})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={promoteSelectedCustomer}
            disabled={saving || !selectedCustomerId}
            className="mt-4 w-full rounded-xl bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            Promote to Agent
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0f172a]">Create Agent</h2>
          <p className="mt-1 text-sm text-slate-500">Create a fresh agent account with optional API key generation.</p>

          <div className="mt-4 grid gap-3">
            <input
              value={createAgentForm.username}
              onChange={(event) =>
                setCreateAgentForm((prev) => ({ ...prev, username: event.target.value }))
              }
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Username"
            />
            <input
              value={createAgentForm.phoneNumber}
              onChange={(event) =>
                setCreateAgentForm((prev) => ({ ...prev, phoneNumber: event.target.value }))
              }
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Phone number"
            />
            <input
              type="password"
              value={createAgentForm.password}
              onChange={(event) =>
                setCreateAgentForm((prev) => ({ ...prev, password: event.target.value }))
              }
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Password"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={createAgentForm.status}
                onChange={(event) =>
                  setCreateAgentForm((prev) => ({
                    ...prev,
                    status: event.target.value as "ACTIVE" | "SUSPENDED"
                  }))
                }
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
              <input
                type="number"
                min={0}
                value={createAgentForm.initialBalance}
                onChange={(event) =>
                  setCreateAgentForm((prev) => ({ ...prev, initialBalance: event.target.value }))
                }
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
                placeholder="Initial wallet"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={createAgentForm.generateApiCredentials}
                onChange={(event) =>
                  setCreateAgentForm((prev) => ({
                    ...prev,
                    generateApiCredentials: event.target.checked
                  }))
                }
              />
              Generate API credential now
            </label>
            {createAgentForm.generateApiCredentials ? (
              <input
                value={createAgentForm.credentialName}
                onChange={(event) =>
                  setCreateAgentForm((prev) => ({ ...prev, credentialName: event.target.value }))
                }
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
                placeholder="Credential label"
              />
            ) : null}
          </div>

          <button
            type="button"
            onClick={createAgent}
            disabled={saving}
            className="mt-4 w-full rounded-xl bg-[#0f172a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            Create Agent Account
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0f172a]">API Credentials</h2>
          <p className="mt-1 text-sm text-slate-500">Create, disable, or rotate keys. Secret is shown once only.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Agent
              <select
                value={selectedCredentialAgentId}
                onChange={(event) => setSelectedCredentialAgentId(event.target.value)}
                className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                <option value="">All agents</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.username}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Rate Limit / minute
              <input
                type="number"
                min={1}
                max={5000}
                value={credentialRateLimit}
                onChange={(event) => setCredentialRateLimit(event.target.value)}
                className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3">
            <input
              value={credentialName}
              onChange={(event) => setCredentialName(event.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Credential name"
            />
            <textarea
              value={credentialIpAllowlist}
              onChange={(event) => setCredentialIpAllowlist(event.target.value)}
              className="min-h-[90px] rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="IP allowlist (one IP per line, optional)"
            />
          </div>

          <button
            type="button"
            onClick={createCredential}
            disabled={saving || !selectedCredentialAgentId}
            className="mt-4 rounded-xl bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            Create API Credential
          </button>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Agent</th>
                  <th className="px-4 py-3 text-left">Label</th>
                  <th className="px-4 py-3 text-left">API Key</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Last Request</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCredentials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No API credentials found.</td>
                  </tr>
                ) : (
                  filteredCredentials.map((credential) => (
                    <tr key={credential.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-700">{credential.agent_name}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{credential.name ?? "Default Key"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <code>{credential.api_key}</code>
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
                      <td className="px-4 py-3 text-slate-700">{formatDateTime(credential.last_request_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              patchCredential(credential.id, {
                                status: credential.status === "ACTIVE" ? "DISABLED" : "ACTIVE"
                              })
                            }
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                            disabled={saving}
                          >
                            {credential.status === "ACTIVE" ? "Disable" : "Enable"}
                          </button>
                          <button
                            type="button"
                            onClick={() => rotateCredentialSecret(credential.id)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                            disabled={saving}
                          >
                            Rotate Secret
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCredential(credential.id)}
                            className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600"
                            disabled={saving}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#0f172a]">Wallet Actions</h2>
            <p className="mt-1 text-sm text-slate-500">Credit or debit any agent wallet with reason.</p>
            <div className="mt-4 grid gap-3">
              <select
                value={walletForm.agentId}
                onChange={(event) => setWalletForm((prev) => ({ ...prev, agentId: event.target.value }))}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                <option value="">Select agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.username}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={walletForm.action}
                  onChange={(event) =>
                    setWalletForm((prev) => ({
                      ...prev,
                      action: event.target.value as "credit" | "debit"
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
                >
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </select>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={walletForm.amount}
                  onChange={(event) => setWalletForm((prev) => ({ ...prev, amount: event.target.value }))}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder="Amount"
                />
              </div>
              <input
                value={walletForm.reason}
                onChange={(event) => setWalletForm((prev) => ({ ...prev, reason: event.target.value }))}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
                placeholder="Reason (optional)"
              />
              <button
                type="button"
                onClick={submitWalletAction}
                disabled={saving || !walletForm.agentId}
                className="rounded-xl bg-[#0f172a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                Apply Wallet Action
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#0f172a]">API Request Logs</h2>
                <p className="mt-1 text-sm text-slate-500">Recent reseller API calls and response codes.</p>
              </div>
              <select
                value={selectedLogsAgentId}
                onChange={(event) => setSelectedLogsAgentId(event.target.value)}
                className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
              >
                <option value="">All Agents</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.username}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 max-h-[360px] overflow-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Time</th>
                    <th className="px-4 py-3 text-left">Agent</th>
                    <th className="px-4 py-3 text-left">Request</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading logs...</td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No API logs yet.</td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-700">{formatDateTime(log.createdAt)}</td>
                        <td className="px-4 py-3 text-slate-700">{log.agentName}</td>
                        <td className="px-4 py-3 text-slate-700">
                          <code>{log.method}</code> {log.path}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              log.statusCode >= 400
                                ? "bg-[#fee2e2] text-[#ef4444]"
                                : "bg-[#ecfdf3] text-[#16a34a]"
                            }`}
                          >
                            {log.statusCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {typeof log.durationMs === "number" ? `${log.durationMs}ms` : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[#0f172a]">Agent Accounts</h2>
        <p className="text-sm text-slate-500">Monitor balances, spend, and most recent API activity.</p>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Agent</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Orders</th>
                <th className="px-4 py-3 text-left">Amount Spent</th>
                <th className="px-4 py-3 text-left">Wallet</th>
                <th className="px-4 py-3 text-left">Rewards</th>
                <th className="px-4 py-3 text-left">Last API Request</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">Loading agents...</td>
                </tr>
              ) : agents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">No agents yet.</td>
                </tr>
              ) : (
                agents.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.username}</td>
                    <td className="px-4 py-3 text-slate-600">{row.phoneNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.status === "ACTIVE" ? "bg-[#ecfdf3] text-[#16a34a]" : "bg-[#fee2e2] text-[#ef4444]"}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.ordersCount}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(row.ordersTotalAmount ?? 0, "GHS")}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(row.walletBalance ?? 0, "GHS")}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(row.rewardsBalance ?? 0, "GHS")}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(lastRequestByAgent.get(row.id) ?? null)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => demoteAgent(row.id)}
                        disabled={saving}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-60"
                      >
                        Demote
                      </button>
                    </td>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}
