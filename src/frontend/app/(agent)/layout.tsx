"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "@/frontend/components/auth/RequireAuth";
import { MobileBottomNav } from "@/frontend/components/navigation/MobileBottomNav";
import { Dialog } from "@/frontend/components/ui/dialog";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useTheme } from "@/frontend/providers/ThemeProvider";

type BellNotification = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  read: boolean;
};

type PopupNotification = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

type SidebarNavItem = {
  label: string;
  href: string;
  icon: "grid" | "shopping-bag" | "clock" | "gift" | "wallet" | "terminal" | "user";
};

const sidebarItems: SidebarNavItem[] = [
  { label: "Dashboard", href: "/agent", icon: "grid" },
  { label: "Buy Data", href: "/agent/buy-data", icon: "shopping-bag" },
  { label: "Purchase History", href: "/agent/orders", icon: "clock" },
  { label: "Rewards", href: "/agent/rewards", icon: "gift" },
  { label: "Wallet", href: "/agent/wallet", icon: "wallet" },
  { label: "API", href: "/agent/api", icon: "terminal" }
];

const mobileNavItems = [
  { label: "Home", href: "/agent", icon: "grid" },
  { label: "History", href: "/agent/orders", icon: "clock" },
  { label: "Buy", href: "/agent/buy-data", icon: "shopping-bag" },
  { label: "Rewards", href: "/agent/rewards", icon: "gift" },
  { label: "Wallet", href: "/agent/wallet", icon: "wallet" }
];

const searchablePages: Array<{ label: string; description: string; href: string }> = [
  { label: "Agent Dashboard", description: "Overview, trends and recent orders", href: "/agent" },
  { label: "Profile", description: "Update your account details", href: "/agent/profile" },
  { label: "Buy Data", description: "Purchase bundles for customers", href: "/agent/buy-data" },
  { label: "Purchase History", description: "Track all agent orders", href: "/agent/orders" },
  { label: "Rewards", description: "View cashback and reward history", href: "/agent/rewards" },
  { label: "Wallet", description: "Add funds and review wallet transactions", href: "/agent/wallet" },
  { label: "Reseller API", description: "API credentials and integration docs", href: "/agent/api" }
];

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isBuyData = pathname === "/agent/buy-data";

  const { logout, user } = useAuth();
  const { logoUrl } = useTheme();
  const [showLogout, setShowLogout] = useState(false);

  const displayName = user?.username ?? user?.phoneNumber ?? "Agent";

  const [bellItems, setBellItems] = useState<BellNotification[]>([]);
  const [popups, setPopups] = useState<PopupNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showBell, setShowBell] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [currentPopup, setCurrentPopup] = useState<PopupNotification | null>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];
    return searchablePages.filter((item) => {
      return (
        item.label.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.href.toLowerCase().includes(query)
      );
    });
  }, [searchTerm]);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/notifications?userId=${user.id}`);
      const data = await res.json().catch(() => ({}));
      setBellItems(data.bell ?? []);
      setPopups(data.popups ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // ignore
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (popups.length > 0 && !currentPopup) {
      setCurrentPopup(popups[0]);
      setShowPopup(true);
    }
  }, [popups, currentPopup]);

  useEffect(() => {
    if (!showBell) return;
    const handler = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setShowBell(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showBell]);

  useEffect(() => {
    if (!showSearchResults) return;
    const handler = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSearchResults]);

  const markAsRead = async (notificationId: string) => {
    if (!user?.id) return;
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, notificationId })
      });
    } catch {
      // ignore
    }
  };

  const dismissPopup = () => {
    if (currentPopup) {
      markAsRead(currentPopup.id);
    }
    setShowPopup(false);
    const remaining = popups.filter((item) => item.id !== currentPopup?.id);
    setPopups(remaining);
    setCurrentPopup(null);
  };

  const handleBellOpen = () => {
    setShowBell((prev) => !prev);
    if (!showBell && bellItems.some((item) => !item.read)) {
      for (const item of bellItems.filter((entry) => !entry.read)) {
        markAsRead(item.id);
      }
      setBellItems((previous) => previous.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    }
  };

  const formatNotifDate = (iso: string) => {
    const date = new Date(iso);
    return (
      date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
      " " +
      date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    );
  };

  return (
    <RequireAuth role="AGENT">
      <div className="min-h-screen bg-[#f7f7f3] text-slate-900">
        <div className="flex min-h-screen">
          <aside
            className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-out lg:flex overflow-hidden ${
              isBuyData
                ? "w-0 -translate-x-full opacity-0 pointer-events-none border-transparent"
                : "w-64 translate-x-0 opacity-100"
            }`}
          >
            <div className="flex items-center gap-3 px-6 py-6">
              {logoUrl ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                  <Image src={logoUrl} alt="Keldatagh logo" width={36} height={36} priority className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-[#0f172a]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
                  </svg>
                </div>
              )}
              <span className="text-lg font-black">Keldatagh</span>
            </div>

            <div className="px-4">
              <Link
                href="/agent/profile"
                className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                  pathname === "/agent/profile"
                    ? "border-[rgb(var(--accent-rgb)/0.4)] bg-[rgb(var(--accent-rgb)/0.08)]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-[rgb(var(--accent-rgb)/0.3)]" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                  <p className="text-xs text-slate-500">Agent</p>
                </div>
              </Link>
            </div>

            <nav className="mt-4 flex flex-1 flex-col gap-2 px-4">
              {sidebarItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                      active
                        ? "bg-[rgb(var(--accent-rgb)/0.2)] text-[#0f172a]"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                      {renderSidebarIcon(item.icon)}
                    </span>
                    {item.label}
                  </Link>
                );
              })}

              <button
                type="button"
                className="mt-4 flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-semibold text-red-500 transition-all hover:bg-red-50"
                onClick={() => setShowLogout(true)}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-red-500 shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                </span>
                Logout
              </button>
            </nav>

            <div className="mt-auto px-6 py-6" />
          </aside>

          <div className="flex flex-1 flex-col">
            {!isBuyData ? (
              <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-[#f7f7f3] px-4 py-4 sm:px-6 sm:py-5 lg:px-10">
                <div className="min-w-0 lg:hidden">
                  <div className="flex min-w-0 items-center gap-2">
                    {logoUrl ? (
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
                        <Image src={logoUrl} alt="Keldatagh logo" width={32} height={32} priority className="h-full w-full object-contain" />
                      </div>
                    ) : null}
                    <span className="text-lg font-black">Keldatagh</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                  <div className="relative hidden md:block" ref={searchRef}>
                    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" />
                        <path d="M20 20l-3.5-3.5" />
                      </svg>
                      <input
                        value={searchTerm}
                        onChange={(event) => {
                          setSearchTerm(event.target.value);
                          setShowSearchResults(Boolean(event.target.value.trim()));
                        }}
                        onFocus={() => setShowSearchResults(Boolean(searchTerm.trim()))}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          const first = searchResults[0];
                          if (!first) return;
                          setShowSearchResults(false);
                          router.push(first.href);
                        }}
                        className="w-48 bg-transparent text-sm text-slate-600 outline-none"
                        placeholder="Search pages..."
                      />
                    </div>
                    {showSearchResults ? (
                      <div className="absolute right-0 top-12 z-[70] w-[22rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
                        {searchResults.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-slate-500">No results found.</p>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {searchResults.slice(0, 8).map((item) => (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => {
                                  setShowSearchResults(false);
                                  setSearchTerm("");
                                }}
                                className="block px-4 py-3 transition hover:bg-slate-50"
                              >
                                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                                <p className="text-xs text-slate-500">{item.description}</p>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="relative" ref={bellRef}>
                    <button
                      type="button"
                      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
                      onClick={handleBellOpen}
                      aria-label="Notifications"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      {unreadCount > 0 ? (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      ) : null}
                    </button>

                    {showBell ? (
                      <div className="fixed left-4 right-4 top-20 z-[70] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.12)] md:absolute md:left-auto md:right-0 md:top-12 md:w-80 md:max-h-96">
                        <div className="border-b border-slate-100 px-4 py-3">
                          <p className="text-sm font-bold text-slate-900">Notifications</p>
                        </div>
                        {bellItems.length === 0 ? (
                          <div className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet</div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {bellItems.map((item) => (
                              <div key={item.id} className={`px-4 py-3 ${!item.read ? "bg-blue-50/50" : ""}`}>
                                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                <div
                                  className="mt-1 text-xs text-slate-600 line-clamp-3 prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ __html: item.content }}
                                />
                                <p className="mt-1 text-[10px] text-slate-400">{formatNotifDate(item.createdAt)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <Link
                    href="/agent/api"
                    className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 sm:inline-flex"
                  >
                    API Docs
                  </Link>

                  <Link
                    href="/agent/profile"
                    className="flex min-w-0 items-center gap-2 overflow-hidden rounded-2xl border border-slate-200 bg-white px-2 py-1.5 text-left transition hover:border-slate-300 sm:hidden sm:gap-3 sm:px-3 sm:py-2"
                  >
                    <div className="h-8 w-8 shrink-0 rounded-full bg-[rgb(var(--accent-rgb)/0.3)] sm:h-9 sm:w-9" />
                    <div className="min-w-0 overflow-hidden">
                      <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                      <p className="hidden truncate text-xs text-slate-500 sm:block">Agent</p>
                    </div>
                  </Link>
                </div>
              </header>
            ) : null}

            <main
              className={
                isBuyData
                  ? "flex-1 w-full overflow-x-hidden px-4 pb-40 md:px-0 md:pb-0"
                  : "flex-1 overflow-x-hidden px-4 py-4 pb-40 sm:px-6 sm:py-6 md:pb-6 lg:px-10"
              }
            >
              {children}
            </main>
          </div>
        </div>
      </div>

      <MobileBottomNav homeHref="/agent" navItems={mobileNavItems} />

      <Dialog open={showPopup} onClose={dismissPopup}>
        <div className="p-6">
          {currentPopup ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-white">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{currentPopup.title}</h3>
              </div>
              <div
                className="mt-4 text-sm text-slate-600 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: currentPopup.content }}
              />
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  className="rounded-full bg-[#2563eb] px-6 py-2 text-sm font-semibold text-white"
                  onClick={dismissPopup}
                >
                  Got it
                </button>
              </div>
            </>
          ) : null}
        </div>
      </Dialog>

      <Dialog open={showLogout} onClose={() => setShowLogout(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900">Log out?</h3>
          <p className="mt-2 text-sm text-slate-500">Are you sure you want to log out of your agent account?</p>
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
              onClick={() => setShowLogout(false)}
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white"
              onClick={() => {
                logout();
                window.location.href = "/";
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </Dialog>
    </RequireAuth>
  );
}

function renderSidebarIcon(icon: SidebarNavItem["icon"]) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icon === "grid" ? (
        <>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </>
      ) : null}
      {icon === "shopping-bag" ? (
        <>
          <path d="M6 7h12l-1 12H7L6 7z" />
          <path d="M9 7V5a3 3 0 0 1 6 0v2" />
        </>
      ) : null}
      {icon === "clock" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v5l3 2" />
        </>
      ) : null}
      {icon === "gift" ? (
        <>
          <path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" />
          <path d="M2 7h20v5H2z" />
          <path d="M12 22V7" />
          <path d="M12 7a2.5 2.5 0 1 0-5 0" />
          <path d="M12 7a2.5 2.5 0 1 1 5 0" />
        </>
      ) : null}
      {icon === "wallet" ? (
        <>
          <path d="M3 7h15a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
          <path d="M16 7V5a2 2 0 0 0-2-2H5" />
          <path d="M16 12h4" />
        </>
      ) : null}
      {icon === "terminal" ? (
        <>
          <path d="M4 17l5-5-5-5" />
          <path d="M12 19h8" />
        </>
      ) : null}
      {icon === "user" ? (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c1.8-3.5 6-5 8-5s6.2 1.5 8 5" />
        </>
      ) : null}
    </svg>
  );
}
