import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offers",
  description: "Discover the best data bundle offers in Ghana. Save more with Keldatagh.",
  alternates: { canonical: "/offers" }
};

export default function OffersPage() {
  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Keldatagh Offers</p>
          <h1 className="mt-3 text-3xl font-black text-[#0f172a] md:text-4xl">
            Buy Cheap Data Bundles in Ghana
          </h1>
          <p className="mt-3 text-sm text-slate-600 md:text-base">
            Grab limited-time data bundle offers across MTN, Telecel, and AirtelTigo. Fast delivery, secure payments, and cashback rewards on every purchase.
          </p>

          <div className="mt-6 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3">
              Instant data delivery in Ghana
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3">
              Secure payments and wallet top-ups
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3">
              Rewards on every completed order
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3">
              Discounts on popular bundles
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
              href="/pricing"
              className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
