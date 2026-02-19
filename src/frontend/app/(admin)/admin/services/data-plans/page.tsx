"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/shared/utils/formatters";
import { useAuth } from "@/frontend/hooks/useAuth";

interface NetworkOption {
  id: string;
  name: string;
  displayName: string;
}

interface PlanRow {
  id: string;
  networkId: string;
  networkName: string;
  name: string;
  price: number;
  validity: string;
  featured: boolean;
  currency: string;
}

export default function Page() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [networks, setNetworks] = useState<NetworkOption[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    networkId: "",
    price: "",
    validity: "",
    featured: false
  });
  const [addForm, setAddForm] = useState({
    name: "",
    networkId: "",
    price: "",
    validity: "",
    featured: false
  });
  const [filterNetworkId, setFilterNetworkId] = useState<string>("");

  const loadNetworks = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch("/api/networks?scope=all", {
        headers: { "x-user-id": user.id }
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        return;
      }
      setNetworks(
        (Array.isArray(data) ? data : []).map((network: any) => ({
          id: network.id,
          name: network.name,
          displayName: network.displayName
        }))
      );
    } catch {
      setNetworks([]);
    }
  };

  const loadPlans = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/data-plans?scope=all", {
        headers: { "x-user-id": user.id }
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError("Unable to load data plans.");
        setPlans([]);
        return;
      }
      setPlans(
        (Array.isArray(data) ? data : []).map((plan: any) => ({
          id: plan.id,
          networkId: plan.networkId,
          networkName: plan.network?.displayName ?? plan.network?.name ?? "Network",
          name: plan.dataAmount ?? plan.name,
          price: plan.price,
          validity: plan.validity ?? "",
          featured: plan.isFeatured ?? false,
          currency: plan.currency ?? "GHS"
        }))
      );
    } catch {
      setError("Unable to load data plans.");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNetworks();
    loadPlans();
  }, [user?.id]);

  const networkOptions = useMemo(() => {
    if (networks.length === 0) return [];
    return networks;
  }, [networks]);

  const filteredPlans = useMemo(() => {
    if (!filterNetworkId) return plans;
    return plans.filter((p) => p.networkId === filterNetworkId);
  }, [plans, filterNetworkId]);

  const openEdit = (plan: PlanRow) => {
    setEditForm({
      name: plan.name,
      networkId: plan.networkId,
      price: plan.price.toFixed(2),
      validity: plan.validity,
      featured: plan.featured
    });
    setEditingId(plan.id);
  };

  const closeEdit = () => {
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!editingId) return;
    const parsedPrice = Number(editForm.price);
    const payload = {
      name: editForm.name.trim(),
      dataAmount: editForm.name.trim(),
      networkId: editForm.networkId,
      price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
      validity: editForm.validity.trim(),
      isFeatured: editForm.featured
    };
    try {
      const response = await fetch(`/api/data-plans/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": user?.id ?? "" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to update data plan.");
        return;
      }
      setEditingId(null);
      loadPlans();
    } catch {
      setError("Unable to update data plan.");
    }
  };

  const openAdd = () => {
    setAddForm({
      name: "",
      networkId: networks[0]?.id ?? "",
      price: "",
      validity: "",
      featured: false
    });
    setShowAdd(true);
  };

  const closeAdd = () => {
    setShowAdd(false);
  };

  const handleAdd = async () => {
    const parsedPrice = Number(addForm.price);
    const payload = {
      name: addForm.name.trim() || "New Plan",
      dataAmount: addForm.name.trim() || "New Plan",
      networkId: addForm.networkId,
      price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
      validity: addForm.validity.trim() || "30 days",
      isFeatured: addForm.featured
    };

    try {
      const response = await fetch("/api/data-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user?.id ?? "" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to create data plan.");
        return;
      }
      setShowAdd(false);
      loadPlans();
    } catch {
      setError("Unable to create data plan.");
    }
  };

  const handleDelete = async (plan: PlanRow) => {
    if (!window.confirm(`Delete ${plan.name} (${plan.networkName})? This action cannot be undone.`)) {
      return;
    }
    try {
      const response = await fetch(`/api/data-plans/${plan.id}`, {
        method: "DELETE",
        headers: { "x-user-id": user?.id ?? "" }
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to delete data plan.");
        return;
      }
      loadPlans();
    } catch {
      setError("Unable to delete data plan.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0f172a]">Data Plans</h1>
          <p className="text-sm text-slate-500">Manage all bundle pricing and display order.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="filter-network" className="sr-only">Filter by Network</label>
            <select
              id="filter-network"
              value={filterNetworkId}
              onChange={(e) => setFilterNetworkId(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-[#2563eb]"
            >
              <option value="">All Networks</option>
              {networkOptions.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.displayName}
                </option>
              ))}
            </select>
          </div>
          <button
            className="rounded-full bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white"
            onClick={openAdd}
            type="button"
          >
            Add Plan
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {filteredPlans.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {loading ? "Loading plans..." : filterNetworkId ? "No plans for this network." : "No plans found."}
          </div>
        ) : (
          filteredPlans.map((plan) => (
            <div key={plan.id} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              {plan.featured ? (
                <span className="absolute right-4 top-4 rounded-full bg-[#f6c500] px-3 py-1 text-[10px] font-semibold text-[#0f172a]">
                  Most Popular
                </span>
              ) : null}
              <p className="text-sm font-semibold text-slate-500">{plan.networkName}</p>
              <p className="mt-2 text-2xl font-black text-[#0f172a]">{plan.name}</p>
              <p className="mt-1 text-sm font-semibold text-[#2563eb]">
                {formatCurrency(plan.price, plan.currency)}
              </p>
              <p className="mt-1 text-xs text-slate-400">{plan.networkName}</p>
              <div className="mt-5 flex items-center gap-2">
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                  onClick={() => openEdit(plan)}
                  type="button"
                >
                  Edit
                </button>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                  onClick={() => handleDelete(plan)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {editingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0f172a]">Edit Data Plan</h2>
                <p className="text-xs text-slate-500">Update plan pricing and metadata.</p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={closeEdit}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4">
              <label className="text-xs font-semibold text-slate-500">
                Network
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                  value={editForm.networkId}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, networkId: event.target.value }))}
                >
                  {networkOptions.map((network) => (
                    <option key={network.id} value={network.id}>
                      {network.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Plan Name
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="text-xs font-semibold text-slate-500">
                  Price (GHS)
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.price}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, price: event.target.value }))}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Validity
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                    value={editForm.validity}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, validity: event.target.value }))}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={editForm.featured}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, featured: event.target.checked }))}
                />
                Mark as featured
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                onClick={closeEdit}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white"
                onClick={handleSave}
              >
                Save Plan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0f172a]">Add Data Plan</h2>
                <p className="text-xs text-slate-500">Create a new bundle plan.</p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={closeAdd}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4">
              <label className="text-xs font-semibold text-slate-500">
                Network
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                  value={addForm.networkId}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, networkId: event.target.value }))}
                >
                  {networkOptions.map((network) => (
                    <option key={network.id} value={network.id}>
                      {network.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Plan Name
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                  value={addForm.name}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="text-xs font-semibold text-slate-500">
                  Price (GHS)
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                    type="number"
                    step="0.01"
                    min="0"
                    value={addForm.price}
                    onChange={(event) => setAddForm((prev) => ({ ...prev, price: event.target.value }))}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Validity
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                    value={addForm.validity}
                    onChange={(event) => setAddForm((prev) => ({ ...prev, validity: event.target.value }))}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={addForm.featured}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, featured: event.target.checked }))}
                />
                Mark as featured
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                onClick={closeAdd}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white"
                onClick={handleAdd}
              >
                Add Plan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
