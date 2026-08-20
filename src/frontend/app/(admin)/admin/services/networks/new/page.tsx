"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/frontend/hooks/useAuth";
import { getNetworkLogoUrl } from "@/frontend/lib/networkBranding";

const getLogoForName = (name: string) => {
  return getNetworkLogoUrl(name) ?? "/images/networks/MTN-Logo.png";
};

export default function Page() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState("1");
  const [error, setError] = useState<string | null>(null);

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

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !displayName.trim()) return;
    if (!user?.id) return;
    if (logoUploading) return;

    try {
      const response = await fetch("/api/networks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({
          name: trimmedName,
          displayName: displayName.trim(),
          logoUrl: logoUrl || getLogoForName(trimmedName),
          isActive: true,
          sortOrder: Number(sortOrder) || 1
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to create network.");
        return;
      }
      router.push("/admin/services/networks");
    } catch {
      setError("Unable to create network.");
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-black text-[#0f172a]">Add Network</h1>
        <p className="text-sm text-slate-500">Create a new network provider.</p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-700">Network Name</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="MTN"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Display Name</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="MTN Ghana"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Sort Order</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="1"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Logo</label>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="h-16 w-16 rounded-2xl border border-slate-200 bg-[#f8fafc]">
                {logoUrl ? (
                  <div
                    className="h-full w-full rounded-2xl bg-center bg-no-repeat"
                    style={{ backgroundImage: `url('${logoUrl}')`, backgroundSize: "cover" }}
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
                      setLogoUrl("");
                      return;
                    }
                    setLogoUploadError(null);
                    setLogoUploading(true);
                    setLogoFileName(file.name);
                    const previewUrl = URL.createObjectURL(file);
                    setLogoUrl(previewUrl);
                    try {
                      const uploadedUrl = await uploadLogo(file);
                      setLogoUrl(uploadedUrl);
                    } catch (uploadError) {
                      setLogoUploadError(
                        uploadError instanceof Error
                          ? uploadError.message
                          : "Unable to upload logo."
                      );
                      setLogoUrl((prev) => (prev === previewUrl ? "" : prev));
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
                      setLogoUrl(getLogoForName(name || "network"));
                      setLogoFileName("Using default logo");
                      setLogoUploadError(null);
                    }}
                  >
                    Use Default
                  </button>
                  {logoUploading ? (
                    <span className="text-xs font-semibold text-slate-400">Uploading...</span>
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
        </div>

        <div className="mt-6 flex gap-3">
          <button
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
            onClick={() => router.push("/admin/services/networks")}
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
      </section>
    </div>
  );
}
