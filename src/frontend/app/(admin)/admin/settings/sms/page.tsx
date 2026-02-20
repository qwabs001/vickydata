"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/frontend/hooks/useAuth";
import type { SmsSettings } from "@/backend/services/smsSettingsService";

export default function Page() {
  const { user } = useAuth();
  const [form, setForm] = useState<SmsSettings>({
    enabled: false,
    provider: "africastalking",
    africastalking: { username: "", apiKey: "", sandbox: true },
    termii: { apiKey: "", senderId: "" },
    orderCompleteTemplate: "Your order {{orderNumber}} is complete. {{planName}} has been delivered to {{recipient}}.",
    walletTopUpTemplate: "Your GhBundle wallet has been credited with GHS {{amount}}. New balance: GHS {{balance}}."
  });
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/sms", { headers: { "x-user-id": user.id } });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setForm((prev) => ({
          ...prev,
          enabled: data.enabled ?? false,
          provider: data.provider ?? "africastalking",
          africastalking: { ...prev.africastalking, ...data.africastalking },
          termii: { ...prev.termii, ...data.termii },
          orderCompleteTemplate: data.orderCompleteTemplate ?? prev.orderCompleteTemplate,
          walletTopUpTemplate: data.walletTopUpTemplate ?? prev.walletTopUpTemplate
        }));
      }
    } catch {
      setSaveNotice("Unable to load SMS settings.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const save = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch("/api/admin/settings/sms", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify(form)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveNotice(data?.error ?? "Failed to save.");
        return;
      }
      setSaveNotice("SMS settings saved.");
      setSaved(true);
      window.setTimeout(() => {
        setSaved(false);
        setSaveNotice(null);
      }, 2000);
    } catch {
      setSaveNotice("Failed to save SMS settings.");
    }
  };

  const sendTest = async () => {
    if (!user?.id || !testPhone.trim()) {
      setTestStatus("Enter a phone number first (e.g. 233XXXXXXXXX).");
      return;
    }
    setTestStatus(null);
    try {
      const res = await fetch("/api/admin/settings/sms/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ phone: testPhone.trim() })
      });
      const data = await res.json().catch(() => null);
      setTestStatus(data?.ok ? "Test SMS sent! Check the phone." : data?.message ?? data?.error ?? "Failed.");
    } catch {
      setTestStatus("Test failed.");
    }
  };

  if (loading) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <h1 className="text-2xl font-black text-[#0f172a]">SMS Settings</h1>
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-black text-[#0f172a]">SMS Notifications</h1>
        <p className="text-sm text-slate-500">
          Send SMS when orders complete and when users add funds. Uses Africa&apos;s Talking or Termii.
        </p>
      </header>

      {saveNotice ? (
        <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-600">
          {saveNotice}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#0f172a]">Enable SMS</h2>
            <p className="text-sm text-slate-500">Turn on SMS for order completion and wallet top-up.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm font-medium text-slate-700">Enabled</span>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <h2 className="text-lg font-bold text-[#0f172a]">Provider</h2>
        <p className="mt-1 text-sm text-slate-500">
          <strong>Africa&apos;s Talking</strong> — Pan-African, ~$0.01/SMS.{" "}
          <a href="https://africastalking.com" target="_blank" rel="noreferrer" className="text-[#2563eb] underline">
            africastalking.com
          </a>
        </p>
        <p className="mt-1 text-sm text-slate-500">
          <strong>Termii</strong> — West Africa, Nigeria/Ghana.{" "}
          <a href="https://termii.com" target="_blank" rel="noreferrer" className="text-[#2563eb] underline">
            termii.com
          </a>
        </p>
        <select
          className="mt-4 w-full max-w-xs rounded-xl border border-slate-200 px-4 py-3 text-sm"
          value={form.provider}
          onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value as SmsSettings["provider"] }))}
        >
          <option value="africastalking">Africa&apos;s Talking</option>
          <option value="termii">Termii</option>
        </select>
      </section>

      {form.provider === "africastalking" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <h2 className="text-lg font-bold text-[#0f172a]">Africa&apos;s Talking</h2>
          <p className="mt-1 text-sm text-slate-500">Get credentials from your Africa&apos;s Talking dashboard.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Username (e.g. sandbox)"
              value={form.africastalking.username}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  africastalking: { ...p.africastalking, username: e.target.value }
                }))
              }
            />
            <input
              type="password"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="API Key"
              value={form.africastalking.apiKey}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  africastalking: { ...p.africastalking, apiKey: e.target.value }
                }))
              }
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.africastalking.sandbox}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    africastalking: { ...p.africastalking, sandbox: e.target.checked }
                  }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-600">Use sandbox (for testing)</span>
            </label>
            {form.africastalking.sandbox && (
              <p className="text-xs text-amber-600">
                Sandbox only delivers to numbers registered at{" "}
                <a
                  href="https://simulator.africastalking.com:1517"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  simulator.africastalking.com
                </a>
                . Register your phone there first, then send the test.
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <h2 className="text-lg font-bold text-[#0f172a]">Termii</h2>
          <p className="mt-1 text-sm text-slate-500">Get API key and sender ID from Termii dashboard.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input
              type="password"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="API Key"
              value={form.termii.apiKey}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  termii: { ...p.termii, apiKey: e.target.value }
                }))
              }
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Sender ID (e.g. GhBundle)"
              value={form.termii.senderId}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  termii: { ...p.termii, senderId: e.target.value }
                }))
              }
            />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <h2 className="text-lg font-bold text-[#0f172a]">Message Templates</h2>
        <p className="mt-1 text-sm text-slate-500">Placeholders: {`{{orderNumber}} {{planName}} {{recipient}} {{amount}} {{balance}}`}</p>
        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500">Order complete</label>
            <textarea
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              rows={2}
              value={form.orderCompleteTemplate}
              onChange={(e) => setForm((p) => ({ ...p, orderCompleteTemplate: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Wallet top-up</label>
            <textarea
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              rows={2}
              value={form.walletTopUpTemplate}
              onChange={(e) => setForm((p) => ({ ...p, walletTopUpTemplate: e.target.value }))}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <h2 className="text-lg font-bold text-[#0f172a]">Test SMS</h2>
        <p className="mt-1 text-sm text-slate-500">Send a test message to verify your configuration.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm md:w-64"
            placeholder="Phone (e.g. 233XXXXXXXXX)"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
          />
          <button
            type="button"
            onClick={sendTest}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Send Test
          </button>
          {testStatus ? (
            <span className="text-sm text-slate-600">{testStatus}</span>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          className="rounded-full bg-[#2563eb] px-6 py-2 text-sm font-semibold text-white"
        >
          Save Settings
        </button>
        {saved ? (
          <span className="self-center text-sm font-semibold text-[#16a34a]">Saved</span>
        ) : null}
      </div>
    </div>
  );
}
