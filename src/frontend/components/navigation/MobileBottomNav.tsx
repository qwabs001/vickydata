"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { label: string; href: string; icon: string };

const defaultNavItems: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: "grid" },
  { label: "History", href: "/orders", icon: "clock" },
  { label: "Buy", href: "/dashboard/buy-data", icon: "shopping-bag" },
  { label: "Rewards", href: "/rewards", icon: "gift" },
  { label: "Wallet", href: "/rewards/withdraw", icon: "wallet" }
];

type Props = {
  /** When on landing page, pass "/" so Home links to landing */
  homeHref?: string;
  navItems?: NavItem[];
};

export function MobileBottomNav({ homeHref = "/dashboard", navItems }: Props) {
  const pathname = usePathname();
  const sourceItems = navItems ?? defaultNavItems;
  const items: NavItem[] = sourceItems.map((item) =>
    item.label === "Home" ? { ...item, href: homeHref } : item
  );

  return (
    <nav
      data-mobile-nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-2 shadow-[0_-10px_25px_rgba(15,23,42,0.06)] backdrop-blur-md md:hidden pointer-events-auto"
    >
      <div className="flex items-center justify-between">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const isBuy = item.icon === "shopping-bag";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 text-[10px] font-semibold ${
                isActive ? "text-[var(--accent)]" : "text-slate-500"
              } ${isBuy ? "relative -mt-5" : ""}`}
            >
              <span
                className={`flex items-center justify-center ${
                  isBuy ? "h-14 w-14 rounded-[20px]" : "h-9 w-9 rounded-xl"
                } ${
                  isBuy
                    ? isActive
                      ? "text-[#0f172a] ring-4 ring-[rgb(var(--accent-rgb)/0.25)] bg-[linear-gradient(135deg,rgba(var(--accent-rgb),0.85),rgba(255,255,255,0.5))] shadow-[0_18px_34px_rgba(15,23,42,0.2),inset_0_1px_0_rgba(255,255,255,0.6)] border border-white/70 backdrop-blur-2xl"
                      : "text-[var(--accent)] bg-white/55 border border-white/70 shadow-[0_14px_28px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-2xl"
                    : isActive
                      ? "bg-[rgb(var(--accent-rgb)/0.16)]"
                      : "bg-transparent"
                } ${isBuy ? "transition-transform duration-150 active:scale-95" : ""}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={isBuy ? "h-7 w-7" : "h-5 w-5"}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {item.icon === "grid" ? (
                    <>
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </>
                  ) : null}
                  {item.icon === "shopping-bag" ? (
                    <>
                      <path d="M6 7h12l-1 12H7L6 7z" />
                      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
                    </>
                  ) : null}
                  {item.icon === "clock" ? (
                    <>
                      <circle cx="12" cy="12" r="8" />
                      <path d="M12 8v5l3 2" />
                    </>
                  ) : null}
                  {item.icon === "gift" ? (
                    <>
                      <path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" />
                      <path d="M2 7h20v5H2z" />
                      <path d="M12 22V7" />
                      <path d="M12 7a2.5 2.5 0 1 0-5 0" />
                      <path d="M12 7a2.5 2.5 0 1 1 5 0" />
                    </>
                  ) : null}
                  {item.icon === "wallet" ? (
                    <>
                      <path d="M3 7h15a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                      <path d="M16 7V5a2 2 0 0 0-2-2H5" />
                      <path d="M16 12h4" />
                    </>
                  ) : null}
                  {item.icon === "terminal" ? (
                    <>
                      <path d="M4 17l5-5-5-5" />
                      <path d="M12 19h8" />
                    </>
                  ) : null}
                </svg>
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
