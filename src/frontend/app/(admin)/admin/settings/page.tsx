"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const cards = [
  {
    title: "Profile & Security",
    description: "Update admin profile details, contact email, and password.",
    href: "/admin/settings/profile"
  },
  {
    title: "API Configuration",
    description: "Connect data bundle API to sync networks and auto-fulfill orders.",
    href: "/admin/settings/api"
  },
  {
    title: "Payments",
    description: "Configure Paystack for purchases, wallet top-ups, and agent upgrades.",
    href: "/admin/settings/payments"
  },
  {
    title: "SMS Notifications",
    description: "Send SMS when orders complete and when users add funds (Africa's Talking, Termii).",
    href: "/admin/settings/sms"
  },
  {
    title: "Theme",
    description: "Brand colors, logo, and UI themes.",
    href: "/admin/settings/theme"
  },
  {
    title: "Agents",
    description: "Configure agent pricing and monitor agent accounts.",
    href: "/admin/agents"
  }
];

export default function Page() {
  const [search, setSearch] = useState("");

  const filteredCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return cards;
    return cards.filter((card) => card.title.toLowerCase().includes(query));
  }, [search]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-black text-[#0f172a]">Settings</h1>
        <p className="text-sm text-slate-500">Configure platform settings and integrations.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-[#f8fafc] px-4 py-2 text-sm text-slate-500">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            className="w-full bg-transparent text-sm text-slate-600 outline-none placeholder:text-slate-400"
            placeholder="Search settings..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {filteredCards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            No settings match your search.
          </div>
        ) : (
          filteredCards.map((card) => (
            <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-lg font-bold text-[#0f172a]">{card.title}</h2>
              <p className="mt-2 text-sm text-slate-500">{card.description}</p>
              <Link href={card.href} className="mt-6 inline-flex rounded-full bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white">
                Open
              </Link>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
