"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RequireAuth } from "@/frontend/components/auth/RequireAuth";
import { Dialog } from "@/frontend/components/ui/dialog";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useTheme } from "@/frontend/providers/ThemeProvider";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: "dashboard", shortLabel: "Home" },
  { label: "Order Management", href: "/admin/orders", icon: "orders", shortLabel: "Orders" },
  { label: "Customers", href: "/admin/users", icon: "users", shortLabel: "Users" },
  { label: "Agents", href: "/admin/agents", icon: "users", shortLabel: "Agents" },
  { label: "Inventory & Plans", href: "/admin/services", icon: "plans", shortLabel: "Plans" },
  { label: "Landing Content", href: "/admin/landing", icon: "landing", shortLabel: "Landing" },
  { label: "Transactions", href: "/admin/rewards", icon: "transactions", shortLabel: "Rewards" },
  { label: "Notifications", href: "/admin/notifications", icon: "bell", shortLabel: "Alerts" },
  { label: "Settings", href: "/admin/settings", icon: "settings", shortLabel: "Settings" },
  { label: "Activity Logs", href: "/admin/activity-logs", icon: "logs", shortLabel: "Logs" }
];

const mobileNavItems = navItems.filter((item) =>
  ["/admin", "/admin/orders", "/admin/users", "/admin/notifications"].includes(item.href)
);
const hamburgerNavItems = navItems.filter((item) =>
  ["/admin/agents", "/admin/services", "/admin/landing", "/admin/rewards", "/admin/settings", "/admin/activity-logs"].includes(
    item.href
  )
);

const iconMap: Record<string, JSX.Element> = {
  dashboard: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12v18H6z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c1.3-3 4-4.5 7-4.5" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M14.5 19.5c.6-1.8 1.8-3 3.5-3.7" />
    </svg>
  ),
  plans: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="6" rx="2" />
      <rect x="4" y="14" width="16" height="6" rx="2" />
    </svg>
  ),
  transactions: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h12" />
      <path d="M8 3l-4 4 4 4" />
      <path d="M20 17H8" />
      <path d="M16 13l4 4-4 4" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.8 1.8 0 000-6l-1.1-.3a6.6 6.6 0 00-1.1-1.9l.6-1a1.8 1.8 0 00-2.5-2.5l-1 .6a6.6 6.6 0 00-1.9-1.1L12 1.6 9.6 2.8a6.6 6.6 0 00-1.9 1.1l-1-.6A1.8 1.8 0 004.2 5.8l.6 1a6.6 6.6 0 00-1.1 1.9L2.6 9a1.8 1.8 0 000 6l1.1.3a6.6 6.6 0 001.1 1.9l-.6 1a1.8 1.8 0 002.5 2.5l1-.6a6.6 6.6 0 001.9 1.1l2.4 1.2 2.4-1.2a6.6 6.6 0 001.9-1.1l1 .6a1.8 1.8 0 002.5-2.5l-.6-1a6.6 6.6 0 001.1-1.9z" />
    </svg>
  ),
  logs: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  ),
  landing: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
};

export default function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { logoUrl } = useTheme();
  const [showHamburger, setShowHamburger] = useState(false);

  return (
    <RequireAuth role="ADMIN">
      <div className="min-h-screen bg-[#f6f8fb]">
        <div className="flex">
          <aside className="sticky top-0 hidden h-screen w-[260px] flex-col gap-6 border-r border-slate-200 bg-white px-6 py-6 lg:flex">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <div className="flex size-10 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
                  <Image
                    src={logoUrl}
                    alt="GhBundle logo"
                    width={36}
                    height={36}
                    priority
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex size-10 items-center justify-center rounded-2xl bg-[#f6c500] text-[#0f172a] shadow-[0_8px_20px_rgba(245,197,0,0.35)]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
                  </svg>
                </div>
              )}
              <span className="text-lg font-black text-[#0f172a]">GHBUNDLE</span>
            </div>

            <Link
              href="/admin/settings/profile"
              className="rounded-2xl bg-[#f4f7fb] p-4 transition hover:bg-[#e9eff8]"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200" />
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">Admin Panel</p>
                  <p className="text-xs text-slate-500">Main Administrator</p>
                </div>
              </div>
            </Link>

            <nav className="flex flex-1 flex-col gap-2">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                      active
                        ? "bg-[#e7efff] text-[#2563eb]"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className={`${active ? "text-[#2563eb]" : "text-slate-500"}`}>
                      {iconMap[item.icon]}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="space-y-2">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50"
                onClick={() => {
                  logout();
                  router.push("/");
                }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l-6-6 6-6" />
                  <path d="M3 12h12" />
                  <path d="M15 6h6v12h-6" />
                </svg>
                Logout
              </button>
            </div>
          </aside>

          <main className="flex-1 overflow-x-hidden px-4 py-4 pb-40 sm:px-6 sm:py-6 lg:px-10 lg:pb-6">{children}</main>
        </div>

        <nav
          data-admin-mobile-nav
          className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-10px_25px_rgba(15,23,42,0.06)] backdrop-blur-md lg:hidden"
        >
          <div className="flex w-full items-center justify-between">
            {mobileNavItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-1 flex-col items-center gap-1 py-1.5 text-[10px] font-semibold transition-colors ${
                    active ? "text-[#2563eb]" : "text-slate-500"
                  }`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    active ? "bg-[#e7efff]" : "bg-transparent"
                  }`}>
                    {iconMap[item.icon]}
                  </span>
                  <span className="truncate w-full text-center">
                    {item.shortLabel ?? item.label}
                  </span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setShowHamburger(true)}
              className={`flex flex-1 flex-col items-center gap-1 py-1.5 text-[10px] font-semibold transition-colors ${
                hamburgerNavItems.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
                  ? "text-[#2563eb]"
                  : "text-slate-500"
              }`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                hamburgerNavItems.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
                  ? "bg-[#e7efff]"
                  : "bg-transparent"
              }`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              </span>
              <span>More</span>
            </button>
          </div>
        </nav>

        <Dialog open={showHamburger} onClose={() => setShowHamburger(false)} mobileBottomSheet>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">More</h3>
              <button
                type="button"
                onClick={() => setShowHamburger(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <nav className="mt-6 flex flex-col gap-2">
              {hamburgerNavItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowHamburger(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                      active ? "bg-[#e7efff] text-[#2563eb]" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className={active ? "text-[#2563eb]" : "text-slate-500"}>
                      {iconMap[item.icon]}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </Dialog>
      </div>
    </RequireAuth>
  );
}
