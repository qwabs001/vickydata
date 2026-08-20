"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/frontend/hooks/useAuth";
import { getNetworkLogoUrl } from "@/frontend/lib/networkBranding";

type NetworkStatus = "Active" | "Inactive";

interface NetworkRow {
  id: string;
  name: string;
  displayName: string;
  planCount: number;
  status: NetworkStatus;
  logoUrl?: string;
  sortOrder: number;
}

const getLogoForName = (name: string) => {
  return getNetworkLogoUrl(name) ?? "/images/networks/MTN-Logo.png";
};

export default function Page() {
  const { user } = useAuth();
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    displayName: "",
    logoUrl: "",
    sortOrder: "",
    status: "Active" as NetworkStatus
  });
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const loadNetworks = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/networks?scope=all", {
        headers: { "x-user-id": user.id }
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError("Unable to load networks.");
        setNetworks([]);
        return;
      }
      const rows = (Array.isArray(data) ? data : []).map((network: any) => ({
        id: network.id,
        name: network.name,
        displayName: network.displayName,
        planCount: network.planCount ?? 0,
        status: (network.isActive ? "Active" : "Inactive") as NetworkStatus,
        logoUrl: network.logoUrl,
        sortOrder: network.sortOrder ?? 0
      }));
      setNetworks(rows);
    } catch {
      setError("Unable to load networks.");
      setNetworks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNetworks();
  }, [user?.id]);

  const openEdit = (network: NetworkRow) => {
    setEditForm({
      name: network.name,
      displayName: network.displayName,
      logoUrl: network.logoUrl ?? "",
      sortOrder: network.sortOrder.toString(),
      status: network.status
    });
    setEditingId(network.id);
    setIsAdding(false);
    setLogoFileName(null);
    setLogoUploadError(null);
    setLogoUploading(false);
  };

  const closeEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setLogoFileName(null);
    setLogoUploadError(null);
    setLogoUploading(false);
  };

  const handleSave = async () => {
    if (!editForm.name.trim() || !editForm.displayName.trim()) return;
    if (logoUploading) return;
    const payload = {
      name: editForm.name.trim(),
      displayName: editForm.displayName.trim(),
      logoUrl: editForm.logoUrl || getLogoForName(editForm.name),
      sortOrder: Number(editForm.sortOrder) || 0,
      isActive: editForm.status === "Active"
    };

    try {
      if (isAdding) {
        const response = await fetch("/api/networks", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": user?.id ?? "" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          setError(data?.error ?? "Unable to create network.");
          return;
        }
      } else if (editingId) {
        const response = await fetch(`/api/networks/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-user-id": user?.id ?? "" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          setError(data?.error ?? "Unable to update network.");
          return;
        }
      }
      closeEdit();
      loadNetworks();
    } catch {
      setError("Unable to save network.");
    }
  };

  const uploadLogo = async (file: File) => {
    if (!user?.id) {
      throw new Error("Please login again to upload a logo.");
    }
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/uploads/network-logo", {
      method: "POST",
      headers: { "x-user-id": user.id },
      body: formData
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error ?? "Unable to upload logo.");
    }
    if (!data?.url) {
      throw new Error("Upload succeeded but no URL was returned.");
    }
    return data.url as string;
  };

  const handleDelete = async (network: NetworkRow) => {
    if (!window.confirm(`Delete ${network.name}? This action cannot be undone.`)) {
      return;
    }
    try {
      const response = await fetch(`/api/networks/${network.id}`, {
        method: "DELETE",
        headers: { "x-user-id": user?.id ?? "" }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Unable to delete network.");
        return;
      }
      loadNetworks();
    } catch {
      setError("Unable to delete network.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0f172a]">Networks</h1>
          <p className="text-sm text-slate-500">Manage providers and API configuration.</p>
        </div>
        <button
          className="rounded-full bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white"
          onClick={() => {
            setEditForm({
              name: "",
              displayName: "",
              logoUrl: "",
              sortOrder: "",
              status: "Active"
            });
            setEditingId("new");
            setIsAdding(true);
            setLogoFileName(null);
            setLogoUploadError(null);
            setLogoUploading(false);
          }}
        >
          Add Network
        </button>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-4 text-left">Name</th>
                <th className="px-4 py-4 text-left">Display Name</th>
                <th className="px-4 py-4 text-left">Plans</th>
                <th className="px-4 py-4 text-left">Status</th>
                <th className="px-4 py-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {networks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    {loading ? "Loading networks..." : "No networks found."}
                  </td>
                </tr>
              ) : (
                networks.map((network) => (
                  <tr key={network.id} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-semibold text-slate-700">{network.name}</td>
                    <td className="px-4 py-4 text-slate-600">{network.displayName}</td>
                    <td className="px-4 py-4 text-slate-600">{network.planCount}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${network.status === "Active" ? "bg-[#ecfdf3] text-[#16a34a]" : "bg-[#fee2e2] text-[#ef4444]"}`}>
                        {network.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                          onClick={() => openEdit(network)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                          onClick={() => handleDelete(network)}
                          type="button"
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
      </section>

      {editingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0f172a]">
                  {isAdding ? "Add Network" : "Edit Network"}
                </h2>
                <p className="text-xs text-slate-500">Update provider details.</p>
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
              Name
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Display Name
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                  value={editForm.displayName}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, displayName: event.target.value }))}
                />
              </label>
              <div>
                <p className="text-xs font-semibold text-slate-500">Logo</p>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl border border-slate-200 bg-[#f8fafc]">
                    {editForm.logoUrl ? (
                      <div
                        className="h-full w-full rounded-2xl bg-center bg-no-repeat"
                        style={{
                          backgroundImage: `url('${editForm.logoUrl}')`,
                          backgroundSize: "cover"
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-400">
                        Logo
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
                      type="file"
                      accept="image/*"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) {
                          setLogoFileName(null);
                          setEditForm((prev) => ({ ...prev, logoUrl: "" }));
                          return;
                        }
                        setLogoUploadError(null);
                        setLogoUploading(true);
                        setLogoFileName(file.name);
                        const previewUrl = URL.createObjectURL(file);
                        setEditForm((prev) => ({ ...prev, logoUrl: previewUrl }));
                        try {
                          const uploadedUrl = await uploadLogo(file);
                          setEditForm((prev) => ({ ...prev, logoUrl: uploadedUrl }));
                        } catch (uploadError) {
                          setLogoUploadError(
                            uploadError instanceof Error
                              ? uploadError.message
                              : "Unable to upload logo."
                          );
                          setEditForm((prev) =>
                            prev.logoUrl === previewUrl ? { ...prev, logoUrl: "" } : prev
                          );
                        } finally {
                          URL.revokeObjectURL(previewUrl);
                          setLogoUploading(false);
                        }
                      }}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                        type="button"
                        onClick={() => {
                          setEditForm((prev) => ({
                            ...prev,
                            logoUrl: getLogoForName(prev.name || "network")
                          }));
                          setLogoFileName("Using default logo");
                          setLogoUploadError(null);
                        }}
                      >
                        Use Default
                      </button>
                      {logoUploading ? (
                        <span className="text-xs font-semibold text-slate-400">
                          Uploading...
                        </span>
                      ) : null}
                      {logoFileName ? (
                        <span className="text-xs font-semibold text-slate-400">
                          {logoFileName}
                        </span>
                      ) : null}
                    </div>
                    {logoUploadError ? (
                      <p className="mt-2 text-xs font-semibold text-rose-500">
                        {logoUploadError}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="text-xs font-semibold text-slate-500">
                  Sort Order
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                    type="number"
                    value={editForm.sortOrder}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Status
                  <select
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                    value={editForm.status}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value as NetworkStatus }))}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                onClick={closeEdit}
              >
                Cancel
              </button>
              <button
                className={`rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white ${
                  logoUploading ? "opacity-60" : ""
                }`}
                onClick={handleSave}
                disabled={logoUploading}
              >
                {logoUploading ? "Uploading..." : "Save Network"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
