import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Keldatagh to buy data, manage orders, and track rewards.",
  alternates: { canonical: "/signin" }
};

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-16">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Sign In</p>
          <h1 className="mt-3 text-3xl font-black text-[#0f172a]">Access Your Keldatagh Account</h1>
          <p className="mt-3 text-sm text-slate-600">
            Sign in to buy data, track orders, and redeem rewards.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/?auth=login"
              className="rounded-full bg-[#0f172a] px-6 py-3 text-sm font-semibold text-white"
            >
              Continue to Sign In
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
