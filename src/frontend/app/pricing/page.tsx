import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Compare data bundle prices in Ghana and buy cheap data instantly with GhBundle.",
  alternates: { canonical: "/pricing" }
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Pricing</p>
          <h1 className="mt-3 text-3xl font-black text-[#0f172a] md:text-4xl">
            Data Bundle Prices That Save You More
          </h1>
          <p className="mt-3 text-sm text-slate-600 md:text-base">
            GhBundle gives you competitive pricing across all major Ghana networks. Check the latest bundle prices and buy in seconds.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
              <p className="text-xs font-semibold text-slate-400">MTN</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Fast, reliable data bundles</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
              <p className="text-xs font-semibold text-slate-400">Telecel</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Affordable daily and monthly plans</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
              <p className="text-xs font-semibold text-slate-400">AirtelTigo</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Best value bundles for every budget</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
              <p className="text-xs font-semibold text-slate-400">Rewards</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Earn cashback on completed orders</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/buy-now"
              className="rounded-full bg-[#0f172a] px-6 py-3 text-sm font-semibold text-white"
            >
              Buy Now
            </Link>
            <Link
              href="/offers"
              className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700"
            >
              View Offers
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
