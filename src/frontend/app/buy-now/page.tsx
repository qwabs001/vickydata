import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buy Now",
  description: "Buy data bundles instantly in Ghana. Select your network, plan, and pay securely.",
  alternates: { canonical: "/buy-now" }
};

export default function BuyNowPage() {
  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Buy Now</p>
          <h1 className="mt-3 text-3xl font-black text-[#0f172a] md:text-4xl">
            Buy Data Bundles Instantly
          </h1>
          <p className="mt-3 text-sm text-slate-600 md:text-base">
            Select your network, choose a data plan, and complete payment in seconds. Delivery is fast and reliable.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
              <p className="text-xs font-semibold text-slate-400">Step 1</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Choose Network</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
              <p className="text-xs font-semibold text-slate-400">Step 2</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Select Plan</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
              <p className="text-xs font-semibold text-slate-400">Step 3</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Pay Securely</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/#buy-now"
              className="rounded-full bg-[#0f172a] px-6 py-3 text-sm font-semibold text-white"
            >
              Start Buying
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
