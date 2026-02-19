"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/frontend/hooks/useAuth";

type NotificationRow = {
  id: string;
  type: "POPUP" | "BELL";
  title: string;
  content: string;
  isActive: boolean;
  readCount: number;
  createdAt: string;
};

export default function Page() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "BELL" as "POPUP" | "BELL", title: "", content: "" });

  const loadNotifications = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        headers: { "x-user-id": user.id }
      });
      const data = await res.json().catch(() => []);
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user?.id]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setError(null);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!form.title.trim() || !form.content.trim()) {
      setError("Title and content are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editId
        ? `/api/admin/notifications/${editId}`
        : "/api/admin/notifications";
      const method = editId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Unable to save.");
        return;
      }
      showNotice(editId ? "Notification updated." : "Notification created.");
      setShowForm(false);
      setEditId(null);
      setForm({ type: "BELL", title: "", content: "" });
      loadNotifications();
    } catch {
      setError("Unable to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (n: NotificationRow) => {
    if (!user?.id) return;
    try {
      await fetch(`/api/admin/notifications/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ isActive: !n.isActive })
      });
      showNotice(n.isActive ? "Notification deactivated." : "Notification activated.");
      loadNotifications();
    } catch {
      setError("Unable to update.");
    }
  };

  const handleDelete = async (n: NotificationRow) => {
    if (!user?.id) return;
    if (!confirm(`Delete "${n.title}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/admin/notifications/${n.id}`, {
        method: "DELETE",
        headers: { "x-user-id": user.id }
      });
      showNotice("Notification deleted.");
      loadNotifications();
    } catch {
      setError("Unable to delete.");
    }
  };

  const openEdit = (n: NotificationRow) => {
    setEditId(n.id);
    setForm({ type: n.type, title: n.title, content: n.content });
    setShowForm(true);
    setError(null);
  };

  const openNew = () => {
    setEditId(null);
    setForm({ type: "BELL", title: "", content: "" });
    setShowForm(true);
    setError(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 max-w-4xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-[#0f172a] sm:text-2xl">Notifications</h1>
          <p className="text-sm text-slate-500">
            Create popup announcements and bell notifications for customers.
          </p>
        </div>
        <button
          type="button"
          className="w-full shrink-0 rounded-xl bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white sm:w-auto"
          onClick={openNew}
        >
          + New Notification
        </button>
      </header>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {/* ── Form ── */}
      {showForm ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:p-6">
          <h2 className="text-base font-bold text-[#0f172a]">
            {editId ? "Edit Notification" : "New Notification"}
          </h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Type
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    form.type === "BELL"
                      ? "border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb]"
                      : "border-slate-200 text-slate-600"
                  }`}
                  onClick={() => setForm((p) => ({ ...p, type: "BELL" }))}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    Bell Notification
                  </div>
                  <p className="mt-1 text-[11px] font-normal text-slate-400">
                    Shows in the notification bell dropdown
                  </p>
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    form.type === "POPUP"
                      ? "border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb]"
                      : "border-slate-200 text-slate-600"
                  }`}
                  onClick={() => setForm((p) => ({ ...p, type: "POPUP" }))}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                    </svg>
                    Popup Announcement
                  </div>
                  <p className="mt-1 text-[11px] font-normal text-slate-400">
                    Shows as popup on first visit (once per user)
                  </p>
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Title</label>
              <input
                type="text"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                placeholder="e.g. New Plans Available!"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Content <span className="normal-case text-slate-400">(supports HTML)</span>
              </label>
              <textarea
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                rows={5}
                placeholder="Write your message here... You can use HTML tags like <b>bold</b>, <a href='...'>link</a>"
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              />
            </div>
            {/* Preview */}
            {form.content.trim() ? (
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Preview</label>
                <div
                  className="mt-2 rounded-xl border border-slate-200 bg-[#f8fafc] p-4 text-sm text-slate-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: form.content }}
                />
              </div>
            ) : null}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                className="rounded-xl bg-[#2563eb] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : editId ? "Update" : "Create"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-600"
                onClick={() => {
                  setShowForm(false);
                  setEditId(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── List ── */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading...</p>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600">No notifications yet</p>
            <p className="mt-1 text-xs text-slate-400">Create one to reach your customers.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <div key={n.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5">
                <div className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  n.type === "POPUP" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                }`}>
                  {n.type === "POPUP" ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">{n.title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      n.type === "POPUP" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                    }`}>
                      {n.type}
                    </span>
                    {!n.isActive && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">{n.content.replace(/<[^>]*>/g, "")}</p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {formatDate(n.createdAt)} · Read by {n.readCount} user{n.readCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggle(n)}
                    className={`relative h-6 w-11 rounded-full transition ${n.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${n.isActive ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600"
                    onClick={() => openEdit(n)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600"
                    onClick={() => handleDelete(n)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
