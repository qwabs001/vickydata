"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/frontend/hooks/useAuth";

type ProfileForm = {
  fullName: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const initialForm: ProfileForm = {
  fullName: "",
  email: "",
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

export default function AdminProfileSettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<ProfileForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/settings/profile", {
          headers: { "x-user-id": user.id }
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          setError(data?.error ?? "Unable to load admin profile.");
          return;
        }
        setForm((prev) => ({
          ...prev,
          fullName: data?.fullName ?? "",
          email: data?.email ?? ""
        }));
      } catch {
        setError("Unable to load admin profile.");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    setError(null);
    setNotice(null);

    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    const payload: Record<string, string> = {
      fullName: form.fullName.trim(),
      email: form.email.trim()
    };
    if (form.newPassword) {
      payload.currentPassword = form.currentPassword;
      payload.newPassword = form.newPassword;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to update profile.");
        return;
      }
      setNotice("Profile updated successfully.");
      setForm((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      }));
    } catch {
      setError("Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-black text-[#0f172a]">Profile & Security</h1>
        <p className="text-sm text-slate-500">Manage admin identity, contact email, and password.</p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        {loading ? (
          <p className="text-sm text-slate-500">Loading profile...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-500">
              Full Name
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                value={form.fullName}
                onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Email
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="admin@bundlearena.com"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Current Password
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                value={form.currentPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              New Password
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                value={form.newPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-slate-500 md:col-span-2">
              Confirm New Password
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                value={form.confirmPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              />
            </label>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>
    </div>
  );
}
