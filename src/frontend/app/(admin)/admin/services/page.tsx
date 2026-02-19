"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { formatCurrency } from "@/shared/utils/formatters";
import { useAuth } from "@/frontend/hooks/useAuth";
import { downloadCsv } from "@/frontend/lib/exportCsv";

type ApiConfig = {
  id: string;
  name: string;
  provider: string;
};

type PreviewNetwork = {
  name: string;
  displayName: string;
  plans: Array<{ name: string; dataAmount: string; price: number; validity: string }>;
};

const DEFAULT_LOGOS: Record<string, string> = {
  MTN: "/images/networks/MTN-Logo.png",
  mtn: "/images/networks/MTN-Logo.png",
  Telecel: "/images/networks/Telecel.webp",
  Vodafone: "/images/networks/Telecel.webp",
  vodafone: "/images/networks/Telecel.webp",
  AirtelTigo: "/images/networks/airteltigo.png",
  airteltigo: "/images/networks/airteltigo.png"
};

export default function Page() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"manual" | "import">("manual");
  const [networks, setNetworks] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [networkRes, planRes, configRes] = await Promise.all([
        fetch("/api/networks?scope=all", { headers: { "x-user-id": user.id } }),
        fetch("/api/data-plans?scope=all", { headers: { "x-user-id": user.id } }),
        fetch("/api/admin/settings/api-config", { headers: { "x-user-id": user.id } })
      ]);
      const networkData = await networkRes.json().catch(() => []);
      const planData = await planRes.json().catch(() => []);
      const configData = await configRes.json().catch(() => []);
      if (networkRes.ok) setNetworks(Array.isArray(networkData) ? networkData : []);
      if (planRes.ok) setPlans(Array.isArray(planData) ? planData : []);
      if (configRes.ok) setApiConfigs(Array.isArray(configData) ? configData : []);
    } catch {
      setNetworks([]);
      setPlans([]);
      setApiConfigs([]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(
    () => [
      { label: "Total Networks", value: networks.length.toString() },
      { label: "Active Plans", value: plans.filter((p) => p.isActive).length.toString() },
      { label: "Featured Plans", value: plans.filter((p) => p.isFeatured).length.toString() }
    ],
    [networks, plans]
  );

  const topPlans = useMemo(() => plans.slice(0, 3), [plans]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0f172a]">Inventory & Plans</h1>
          <p className="text-sm text-slate-500">Manage network providers and data bundles.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
            onClick={() => {
              const networkRows = networks.map((n) => ({
                Name: n.name ?? n.displayName,
                DisplayName: n.displayName ?? "",
                Active: n.isActive ? "Yes" : "No",
                SortOrder: n.sortOrder ?? 0,
                PlanCount: n.planCount ?? n._count?.dataPlans ?? 0
              }));
              const planRows = plans.map((p) => ({
                Network: p.network?.displayName ?? p.network?.name ?? "",
                Name: p.name ?? p.dataAmount ?? "",
                DataAmount: p.dataAmount ?? "",
                Price: formatCurrency(p.price, p.currency ?? "GHS"),
                Active: p.isActive ? "Yes" : "No",
                Featured: p.isFeatured ? "Yes" : "No",
                SortOrder: p.sortOrder ?? 0
              }));
              downloadCsv("networks.csv", networkRows, ["Name", "DisplayName", "Active", "SortOrder", "PlanCount"]);
              downloadCsv("data-plans.csv", planRows, ["Network", "Name", "DataAmount", "Price", "Active", "Featured", "SortOrder"]);
            }}
          >
            Export
          </button>
          <Link href="/admin/services/networks/new" className="rounded-full bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white">
            Add Network
          </Link>
        </div>
      </header>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          className={`rounded-t-xl px-5 py-2.5 text-sm font-semibold transition ${
            activeTab === "manual"
              ? "bg-white text-[#0f172a] shadow-sm"
              : "bg-transparent text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setActiveTab("manual")}
        >
          Add Manual
        </button>
        <button
          type="button"
          className={`rounded-t-xl px-5 py-2.5 text-sm font-semibold transition ${
            activeTab === "import"
              ? "bg-white text-[#0f172a] shadow-sm"
              : "bg-transparent text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setActiveTab("import")}
        >
          Import Service
        </button>
      </div>

      {activeTab === "manual" ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className="mt-3 text-2xl font-black text-[#0f172a]">{s.value}</p>
              </div>
            ))}
          </section>
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#0f172a]">Networks</h2>
                  <p className="text-sm text-slate-500">Add or edit MTN, Telecel, and AirtelTigo.</p>
                </div>
                <Link href="/admin/services/networks" className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
                  Manage
                </Link>
              </div>
              <div className="mt-6 space-y-3">
                {networks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">No networks yet.</div>
                ) : (
                  networks.map((n: any) => (
                    <div key={n.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-[#f8fafc] px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{n.displayName ?? n.name}</p>
                        <p className="text-xs text-slate-400">{n.planCount ?? n._count?.dataPlans ?? 0} plans</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${n.isActive ? "bg-[#ecfdf3] text-[#16a34a]" : "bg-[#fee2e2] text-[#ef4444]"}`}>
                        {n.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#0f172a]">Top Data Plans</h2>
                  <p className="text-sm text-slate-500">Most purchased bundles this week.</p>
                </div>
                <Link href="/admin/services/data-plans" className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
                  View All
                </Link>
              </div>
              <div className="mt-6 space-y-3">
                {topPlans.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">No plans yet.</div>
                ) : (
                  topPlans.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-[#f8fafc] px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{p.dataAmount ?? p.name} • {p.network?.displayName ?? p.network?.name}</p>
                        <p className="text-xs text-slate-400">{formatCurrency(p.price, p.currency ?? "GHS")}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${p.isFeatured ? "bg-[#f6c500] text-[#0f172a]" : "bg-[#eef2ff] text-[#2563eb]"}`}>
                        {p.isFeatured ? "Featured" : "Standard"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      ) : (
        <ImportServiceTab
          user={user}
          apiConfigs={apiConfigs}
          onImportSuccess={loadData}
        />
      )}
    </div>
  );
}

type ServiceItem = {
  id: string;
  networkName: string;
  networkDisplayName: string;
  planName: string;
  dataAmount: string;
  providerPrice: number;
  validity: string;
  description: string;
};

function flattenServices(networks: PreviewNetwork[]): ServiceItem[] {
  const out: ServiceItem[] = [];
  let idx = 0;
  for (const net of networks) {
    for (const p of net.plans) {
      idx++;
      out.push({
        id: `${net.name}|${p.name}`,
        networkName: net.name,
        networkDisplayName: net.displayName,
        planName: p.name,
        dataAmount: p.dataAmount,
        providerPrice: p.price,
        validity: p.validity,
        description: `${net.displayName} - ${p.dataAmount}`
      });
    }
  }
  return out;
}

function ImportServiceTab({
  user,
  apiConfigs,
  onImportSuccess
}: {
  user: { id?: string } | null;
  apiConfigs: ApiConfig[];
  onImportSuccess: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [previewNetworks, setPreviewNetworks] = useState<PreviewNetwork[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [globalExtraPercent, setGlobalExtraPercent] = useState(30);
  const [globalCategory, setGlobalCategory] = useState("same");
  const [planPercentages, setPlanPercentages] = useState<Record<string, number>>({});
  const [planIcons, setPlanIcons] = useState<Record<string, string>>({});
  const [networkLogos, setNetworkLogos] = useState<Record<string, string>>({});

  const allServices = useMemo(() => flattenServices(previewNetworks), [previewNetworks]);
  const categories = useMemo(() => {
    const cats = new Set(allServices.map((s) => s.networkDisplayName));
    cats.add("AirtelTigo");
    return Array.from(cats).sort();
  }, [allServices]);

  const filteredServices = useMemo(() => {
    return allServices.filter((s) => {
      if (categoryFilter && categoryFilter !== "all" && s.networkDisplayName !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!s.id.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q) && !s.planName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allServices, categoryFilter, searchQuery]);

  const selectedServices = useMemo(
    () => allServices.filter((s) => selectedServiceIds.has(s.id)),
    [allServices, selectedServiceIds]
  );

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedServiceIds.size >= filteredServices.length) {
      setSelectedServiceIds((prev) => {
        const next = new Set(prev);
        filteredServices.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedServiceIds((prev) => {
        const next = new Set(prev);
        filteredServices.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  const handleFetch = async () => {
    if (!user?.id || !selectedConfigId) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    setPreviewNetworks([]);
    setSelectedServiceIds(new Set());
    setStep(1);
    setPlanPercentages({});
    setPlanIcons({});
    setNetworkLogos({});
    try {
      const res = await fetch("/api/admin/settings/api-config/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ configId: selectedConfigId })
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok && Array.isArray(data.networks)) {
        setPreviewNetworks(data.networks);
      } else {
        setError(data?.error ?? "Failed to load services.");
      }
    } catch {
      setError("Failed to load services.");
    } finally {
      setLoading(false);
    }
  };

  const goToStep2 = () => {
    if (selectedServiceIds.size === 0) {
      setError("Select at least one service.");
      return;
    }
    setError(null);
    const initial: Record<string, number> = {};
    selectedServices.forEach((s) => {
      initial[s.id] = globalExtraPercent;
    });
    setPlanPercentages(initial);
    setStep(2);
  };

  useEffect(() => {
    if (step === 2 && selectedServiceIds.size > 0) {
      setPlanPercentages((prev) => {
        const next = { ...prev };
        selectedServiceIds.forEach((id) => {
          next[id] = globalExtraPercent;
        });
        return next;
      });
    }
  }, [step, globalExtraPercent, selectedServiceIds]);

  const goToStep1 = () => {
    setStep(1);
  };

  const planPercent = (id: string) => planPercentages[id] ?? globalExtraPercent;
  const setPlanPercent = (id: string, v: number) => setPlanPercentages((p) => ({ ...p, [id]: v }));
  const planIcon = (id: string) => planIcons[id] ?? "";
  const setPlanIcon = (id: string, v: string) => setPlanIcons((i) => ({ ...i, [id]: v }));
  const yourPrice = (s: ServiceItem, pct: number) => Math.round(s.providerPrice * (1 + pct / 100) * 100) / 100;

  const handleImport = async () => {
    if (!user?.id || !selectedConfigId) return;
    if (selectedServices.length === 0) {
      setError("Select at least one service.");
      return;
    }
    setImporting(true);
    setError(null);
    setNotice(null);
    try {
      const servicesToImport = selectedServices.map((s) => ({ network: s.networkName, plan: s.planName }));
      const planMarkups: Record<string, number> = {};
      selectedServices.forEach((s) => {
        planMarkups[`${s.networkName}|${s.planName}`] = planPercent(s.id);
      });
      const logos: Record<string, string> = { ...networkLogos };
      selectedServices.forEach((s) => {
        const icon = planIcon(s.id)?.trim();
        if (icon) logos[s.networkName] = icon;
      });
      const res = await fetch("/api/admin/settings/api-config/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({
          configId: selectedConfigId,
          markupPercent: globalExtraPercent,
          servicesToImport,
          planMarkups,
          networkLogos: Object.keys(logos).length > 0 ? logos : undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setNotice(`Imported ${data.plansAdded ?? 0} plans successfully.`);
        onImportSuccess();
        setStep(1);
        setSelectedServiceIds(new Set());
      } else {
        setError(data?.error ?? "Import failed.");
      }
    } catch {
      setError("Import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3">
        {step === 2 && (
          <button
            type="button"
            onClick={goToStep1}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            ← Back
          </button>
        )}
        <div>
          <h2 className="text-lg font-bold text-[#0f172a]">Import provider services</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {step === 1 ? "Can be further configured on &apos;Services&apos; section" : "Add markup and choose category before adding to Services."}
          </p>
        </div>
      </div>

      {notice && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {step === 1 && (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Provider</label>
              <select
                className="mt-2 block rounded-xl border border-slate-200 px-4 py-3 text-sm min-w-[200px]"
                value={selectedConfigId}
                onChange={(e) => setSelectedConfigId(e.target.value)}
              >
                <option value="">Select provider</option>
                {apiConfigs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              onClick={handleFetch}
              disabled={loading || !selectedConfigId}
            >
              {loading ? "Loading..." : "Load Services"}
            </button>
          </div>

          {apiConfigs.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">
              No API configured. <Link href="/admin/settings/api" className="text-[#2563eb] hover:underline">Add one in Settings</Link>.
            </p>
          )}

          {previewNetworks.length > 0 && (
            <>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Category</label>
                  <select
                    className="mt-2 block rounded-xl border border-slate-200 px-4 py-2.5 text-sm min-w-[180px]"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="ml-auto flex-1 min-w-[200px] max-w-sm">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Search</label>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      placeholder="Search by service ID or name"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm"
                    />
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-500">{filteredServices.length} services available</p>

              <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filteredServices.length > 0 && filteredServices.every((s) => selectedServiceIds.has(s.id))}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm font-semibold text-slate-700">Select all</span>
                  </label>
                </div>
                <div className="max-h-[min(60vh,560px)] overflow-y-auto">
                  {filteredServices.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 hover:bg-slate-50 cursor-pointer last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedServiceIds.has(s.id)}
                        onChange={() => toggleService(s.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-sm font-mono text-slate-500 w-16 shrink-0">{s.id.split("|")[0]}-{s.planName}</span>
                      <span className="text-sm text-slate-800 truncate">{s.description}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-xl bg-[#f97316] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 flex items-center gap-2"
                  onClick={goToStep2}
                  disabled={selectedServiceIds.size === 0}
                >
                  Select services to start import →
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={goToStep2}
                  disabled={selectedServiceIds.size === 0}
                >
                  Continue
                </button>
              </div>
            </>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-6">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Category</label>
              <select
                className="mt-2 block rounded-xl border border-slate-200 px-4 py-2.5 text-sm min-w-[200px]"
                value={globalCategory}
                onChange={(e) => setGlobalCategory(e.target.value)}
              >
                <option value="same">Create same categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Extra price in %</label>
              <input
                type="number"
                min={0}
                max={200}
                step={1}
                value={globalExtraPercent}
                onChange={(e) => setGlobalExtraPercent(parseFloat(e.target.value) || 0)}
                className="mt-2 block w-24 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Service</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Provider price</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Your price</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Extra %</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Icon</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedServices.map((s) => {
                    const pct = planPercent(s.id);
                    const price = yourPrice(s, pct);
                    return (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 last:border-b-0">
                        <td className="px-4 py-3 font-mono text-slate-500">{s.networkName}-{s.planName}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-slate-800">{s.networkDisplayName} - {s.dataAmount}</p>
                            <p className="text-xs text-slate-500 truncate max-w-[200px]">{s.description}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(s.providerPrice)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(price)}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            max={200}
                            step={0.5}
                            value={pct}
                            onChange={(e) => setPlanPercent(s.id, parseFloat(e.target.value) || 0)}
                            className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-right"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={planIcon(s.id)}
                            onChange={(e) => setPlanIcon(s.id, e.target.value)}
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm min-w-[120px]"
                          >
                            <option value="">No icon</option>
                            {Object.entries(DEFAULT_LOGOS).map(([k, v]) => (
                              <option key={k} value={v}>{k}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
              onClick={goToStep1}
            >
              ← Back to selection
            </button>
            <button
              type="button"
              className="rounded-xl bg-[#16a34a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? "Importing..." : `Add ${selectedServices.length} service${selectedServices.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
