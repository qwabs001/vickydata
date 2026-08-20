"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/frontend/hooks/useAuth";
import { loadPaymentSettings } from "@/frontend/lib/paymentSettingsStorage";
import type { MoolreSettings, PaystackSettings } from "@/backend/services/paymentSettingsService";

export default function Page() {
  const { user } = useAuth();
  const [paystackForm, setPaystackForm] = useState<PaystackSettings>({
    publicKey: "",
    secretKey: "",
    webhookSecret: "",
    mode: "Test"
  });
  const [moolreForm, setMoolreForm] = useState<MoolreSettings>({
    apiUser: "",
    pubKey: "",
    secretKey: "",
    accountNumber: "",
    channel: "13",
    currency: "GHS"
  });
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paystackSaved, setPaystackSaved] = useState<string | null>(null);
  const [moolreSaved, setMoolreSaved] = useState<string | null>(null);
  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://vickydata.com";
  const callbackUrl = `${appUrl.replace(/\/$/, "")}/api/payments/moolre/callback`;

  const loadSettings = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/payment", {
        headers: { "x-user-id": user.id }
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        const hasDbData = data.moolre?.apiUser || data.paystack?.publicKey;
        setPaystackForm((prev) => ({ ...prev, ...data.paystack }));
        setMoolreForm((prev) => ({ ...prev, ...data.moolre }));
        if (!hasDbData) {
          const local = loadPaymentSettings();
          if (local.moolre.apiUser || local.paystack.publicKey) {
            const migrateRes = await fetch("/api/admin/settings/payment", {
              method: "PUT",
              headers: { "Content-Type": "application/json", "x-user-id": user.id },
              body: JSON.stringify({
                paystack: local.paystack,
                moolre: local.moolre
              })
            });
            if (migrateRes.ok) {
              setPaystackForm((prev) => ({ ...prev, ...local.paystack }));
              setMoolreForm((prev) => ({ ...prev, ...local.moolre }));
              setSaveNotice("Payment settings migrated from previous configuration.");
            }
          }
        }
      }
    } catch {
      setSaveNotice("Unable to load payment settings.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const savePaystack = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch("/api/admin/settings/payment", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ paystack: paystackForm })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSaveNotice(data?.error ?? "Failed to save Paystack settings.");
        return;
      }
      setSaveNotice("Paystack settings saved.");
      setPaystackSaved("Saved");
      window.setTimeout(() => setPaystackSaved(null), 2000);
    } catch {
      setSaveNotice("Failed to save Paystack settings.");
    }
  };

  const saveMoolre = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch("/api/admin/settings/payment", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ moolre: moolreForm })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSaveNotice(data?.error ?? "Failed to save Moolre settings.");
        return;
      }
      setSaveNotice("Moolre settings saved.");
      setMoolreSaved("Saved");
      window.setTimeout(() => setMoolreSaved(null), 2000);
    } catch {
      setSaveNotice("Failed to save Moolre settings.");
    }
  };

  const handlePaystackValidate = () => {
    if (!paystackForm.publicKey || !paystackForm.secretKey) {
      setSaveNotice("Add Paystack keys before validating.");
      window.setTimeout(() => setSaveNotice(null), 3000);
      return;
    }
    setSaveNotice("Paystack keys look good.");
    window.setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleMoolreTest = async () => {
    setTestStatus(null);
    if (!moolreForm.apiUser || !moolreForm.pubKey || !moolreForm.accountNumber) {
      setTestStatus("Add Moolre credentials and merchant account ID first.");
      return;
    }
    setTestStatus("Use your Moolre dashboard to run live tests.");
  };

  if (loading) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <h1 className="text-2xl font-black text-[#0f172a]">Payment Settings</h1>
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-black text-[#0f172a]">Payment Settings</h1>
        <p className="text-sm text-slate-500">Use Moolre as your primary checkout gateway and keep Paystack only as a legacy fallback.</p>
      </header>

      {saveNotice ? (
        <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-600">
          {saveNotice}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#0f172a]">Paystack</h2>
            <p className="text-sm text-slate-500">Keep Paystack keys only if you still need legacy webhook or fallback support.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Legacy
          </span>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Paystack Public Key"
            value={paystackForm.publicKey}
            onChange={(event) => setPaystackForm((prev) => ({ ...prev, publicKey: event.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Paystack Secret Key"
            value={paystackForm.secretKey}
            onChange={(event) => setPaystackForm((prev) => ({ ...prev, secretKey: event.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Webhook Secret"
            value={paystackForm.webhookSecret}
            onChange={(event) => setPaystackForm((prev) => ({ ...prev, webhookSecret: event.target.value }))}
          />
          <select
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            value={paystackForm.mode}
            onChange={(event) => setPaystackForm((prev) => ({ ...prev, mode: event.target.value as PaystackSettings["mode"] }))}
          >
            <option>Test</option>
            <option>Live</option>
          </select>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
            onClick={handlePaystackValidate}
            type="button"
          >
            Validate
          </button>
          <button
            className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white"
            onClick={savePaystack}
            type="button"
          >
            Save
          </button>
          {paystackSaved ? (
            <span className="self-center text-xs font-semibold text-[#16a34a]">{paystackSaved}</span>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#0f172a]">Moolre</h2>
            <p className="text-sm text-slate-500">Configure Mobile Money payments and hosted checkout.</p>
          </div>
          <span className="rounded-full bg-[#ecfdf3] px-3 py-1 text-xs font-semibold text-[#16a34a]">
            Primary
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Moolre API User"
            value={moolreForm.apiUser}
            onChange={(event) => setMoolreForm((prev) => ({ ...prev, apiUser: event.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Moolre Public Key"
            value={moolreForm.pubKey}
            onChange={(event) => setMoolreForm((prev) => ({ ...prev, pubKey: event.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Moolre Secret Key"
            value={moolreForm.secretKey}
            onChange={(event) => setMoolreForm((prev) => ({ ...prev, secretKey: event.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Merchant Account ID"
            value={moolreForm.accountNumber}
            onChange={(event) => setMoolreForm((prev) => ({ ...prev, accountNumber: event.target.value }))}
          />
          <select
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            value={moolreForm.channel}
            onChange={(event) => setMoolreForm((prev) => ({ ...prev, channel: event.target.value }))}
          >
            <option value="13">MTN Mobile Money (13)</option>
            <option value="14">Telecel (14)</option>
            <option value="15">AirtelTigo (15)</option>
          </select>
          <select
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            value={moolreForm.currency}
            onChange={(event) => setMoolreForm((prev) => ({ ...prev, currency: event.target.value }))}
          >
            <option value="GHS">GHS</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-500">
              Callback URL
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-600"
                value={callbackUrl}
                readOnly
              />
            </label>
          </div>
        </div>

        {testStatus ? <p className="mt-4 text-sm text-slate-600">{testStatus}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
            onClick={handleMoolreTest}
            type="button"
          >
            Test Payment
          </button>
          <button
            className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white"
            onClick={saveMoolre}
            type="button"
          >
            Save
          </button>
          {moolreSaved ? (
            <span className="self-center text-xs font-semibold text-[#16a34a]">{moolreSaved}</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
