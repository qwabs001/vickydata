"use client";

import { useEffect, useMemo, useState } from "react";
import { useLandingConfig } from "@/frontend/providers/LandingConfigProvider";
import { useAuth } from "@/frontend/hooks/useAuth";
import type { LandingConfig, PopularBundleItem } from "@/shared/types";
import { mergeLandingConfig } from "@/shared/utils/landingConfig";

const createItem = (item: PopularBundleItem): PopularBundleItem => ({
  ...item,
  features: [...item.features]
});

export default function Page() {
  const { config, updateConfig, resetConfig } = useLandingConfig();
  const { user } = useAuth();
  const [draft, setDraft] = useState<LandingConfig>(config);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const updateBundle = (index: number, next: Partial<PopularBundleItem>) => {
    setDraft((prev) => {
      const items = prev.popularBundles.items.map(createItem);
      if (next.isFeatured) {
        for (let i = 0; i < items.length; i += 1) {
          items[i] = { ...items[i], isFeatured: i === index };
        }
      } else {
        items[index] = { ...items[index], ...next };
      }
      return {
        ...prev,
        popularBundles: {
          ...prev.popularBundles,
          items
        }
      };
    });
  };

  const updateFeatures = (index: number, value: string) => {
    const features = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    updateBundle(index, { features });
  };

  const activeBundleLabel = useMemo(() => {
    const featured = draft.popularBundles.items.find((item) => item.isFeatured);
    return featured ? featured.title : "None";
  }, [draft]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-black text-[#0f172a]">Landing Content</h1>
        <p className="text-sm text-slate-500">Manage the SMM services section on the landing page.</p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#0f172a]">SMM Services</h2>
            <p className="text-sm text-slate-500">Toggle section visibility and edit service cards.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">Featured: {activeBundleLabel}</span>
            <button
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                draft.popularBundles.enabled
                  ? "bg-[#2563eb] text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  popularBundles: {
                    ...prev.popularBundles,
                    enabled: !prev.popularBundles.enabled
                  }
                }))
              }
            >
              {draft.popularBundles.enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Title</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              value={draft.popularBundles.title}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  popularBundles: { ...prev.popularBundles, title: event.target.value }
                }))
              }
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Subtitle</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              value={draft.popularBundles.subtitle}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  popularBundles: { ...prev.popularBundles, subtitle: event.target.value }
                }))
              }
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">CTA Text</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              value={draft.popularBundles.ctaText}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  popularBundles: { ...prev.popularBundles, ctaText: event.target.value }
                }))
              }
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">CTA Link</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              value={draft.popularBundles.ctaUrl}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  popularBundles: { ...prev.popularBundles, ctaUrl: event.target.value }
                }))
              }
              placeholder="https://malonsocial.com/"
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Buy Now Link</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              value={draft.popularBundles.buyNowUrl}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  popularBundles: { ...prev.popularBundles, buyNowUrl: event.target.value }
                }))
              }
              placeholder="https://malonsocial.com/"
            />
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {draft.popularBundles.items.map((bundle, index) => (
            <div key={bundle.id} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Service {index + 1}</h3>
                <button
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    bundle.isFeatured ? "bg-[#2563eb] text-white" : "bg-white text-slate-500"
                  }`}
                  onClick={() =>
                    updateBundle(index, {
                      isFeatured: !bundle.isFeatured
                    })
                  }
                >
                  {bundle.isFeatured ? "Best Value" : "Set Best Value"}
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                    value={bundle.title}
                    onChange={(event) => updateBundle(index, { title: event.target.value })}
                    placeholder="Service Title"
                  />
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                    value={bundle.description}
                    onChange={(event) => updateBundle(index, { description: event.target.value })}
                    placeholder="Benefit / Description"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                    value={bundle.priceRange}
                    onChange={(event) => updateBundle(index, { priceRange: event.target.value })}
                    placeholder="Price Range"
                  />
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                    value={bundle.ctaLabel}
                    onChange={(event) => updateBundle(index, { ctaLabel: event.target.value })}
                    placeholder="CTA Label"
                  />
                </div>
                <textarea
                  className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                  value={bundle.features.join(", ")}
                  onChange={(event) => updateFeatures(index, event.target.value)}
                  placeholder="Benefits (comma separated)"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
            onClick={() => {
              const next = mergeLandingConfig(null);
              resetConfig();
              setDraft(next);
              setNotice(null);
            }}
          >
            Reset
          </button>
          <button
            className={`rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white ${
              saving ? "opacity-70" : ""
            }`}
            onClick={async () => {
              if (!user?.id) {
                setNotice("Please login again to save changes.");
                return;
              }
              setSaving(true);
              setNotice(null);
              try {
                const response = await fetch("/api/admin/landing", {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                    "x-user-id": user.id
                  },
                  body: JSON.stringify(draft)
                });
                const data = await response.json().catch(() => null);
                if (!response.ok) {
                  setNotice(data?.error ?? "Unable to save landing content.");
                  return;
                }
                updateConfig(data ?? draft);
                setNotice("Landing content saved.");
              } catch {
                setNotice("Unable to save landing content.");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {notice ? (
            <span className="self-center text-xs font-semibold text-slate-500">
              {notice}
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
