"use client";

import { RequireAuth } from "@/frontend/components/auth/RequireAuth";
import { MobileBottomNav } from "@/frontend/components/navigation/MobileBottomNav";
import { Dialog } from "@/frontend/components/ui/dialog";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useTheme } from "@/frontend/providers/ThemeProvider";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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

const navItems = [
  { label: "Profile", href: "/profile", icon: "user" },
  { label: "Dashboard", href: "/dashboard", icon: "grid" },
  { label: "Buy Data", href: "/dashboard/buy-data", icon: "shopping-bag" },
  { label: "Purchase History", href: "/orders", icon: "clock" },
  { label: "Rewards", href: "/rewards", icon: "gift" },
  { label: "Wallet", href: "/rewards/withdraw", icon: "wallet" }
];

export default function CustomerLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isBuyData = pathname === "/dashboard/buy-data";
  const hideHeaderOnMobile = false;
  const { logout, user } = useAuth();
  const [showLogout, setShowLogout] = useState(false);
  const displayName = user?.username ?? user?.phoneNumber ?? "Customer";
  const memberLabel = "Member";
  const { logoUrl } = useTheme();

  // ── Notifications ──
  const [bellItems, setBellItems] = useState<BellNotification[]>([]);
  const [popups, setPopups] = useState<PopupNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showBell, setShowBell] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [currentPopup, setCurrentPopup] = useState<PopupNotification | null>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/notifications?userId=${user.id}`);
      const data = await res.json().catch(() => ({}));
      setBellItems(data.bell ?? []);
      setPopups(data.popups ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch { /* ignore */ }
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Show first unread popup
  useEffect(() => {
    if (popups.length > 0 && !currentPopup) {
      setCurrentPopup(popups[0]);
      setShowPopup(true);
    }
  }, [popups, currentPopup]);

  // Close bell dropdown on outside click
  useEffect(() => {
    if (!showBell) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowBell(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showBell]);

  const markAsRead = async (notificationId: string) => {
    if (!user?.id) return;
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, notificationId })
      });
    } catch { /* ignore */ }
  };

  const dismissPopup = () => {
    if (currentPopup) {
      markAsRead(currentPopup.id);
    }
    setShowPopup(false);
    // Show next popup if any
    const remaining = popups.filter((p) => p.id !== currentPopup?.id);
    setPopups(remaining);
    setCurrentPopup(null);
  };

  const handleBellOpen = () => {
    setShowBell((prev) => !prev);
    // Mark all bell items as read
    if (!showBell && bellItems.some((b) => !b.read)) {
      for (const item of bellItems.filter((b) => !b.read)) {
        markAsRead(item.id);
      }
      setBellItems((prev) => prev.map((b) => ({ ...b, read: true })));
      setUnreadCount(0);
    }
  };

  const formatNotifDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
      " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };
  return (
    <RequireAuth role="CUSTOMER">
      <div className="min-h-screen bg-[#f7f7f3] text-slate-900">
        <div className="flex min-h-screen">
          <aside
            className={`hidden flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-out lg:flex overflow-hidden ${
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
            <nav className="flex flex-1 flex-col gap-2 px-4">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                if (item.label === "Profile") {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                        isActive
                          ? "border-[rgb(var(--accent-rgb)/0.4)] bg-[rgb(var(--accent-rgb)/0.08)]"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-[rgb(var(--accent-rgb)/0.3)]" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                        <p className="text-xs text-slate-500">{memberLabel}</p>
                      </div>
                    </Link>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-[rgb(var(--accent-rgb)/0.2)] text-[#0f172a]"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                        {item.icon === "user" ? (
                          <>
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 20c1.8-3.5 6-5 8-5s6.2 1.5 8 5" />
                          </>
                        ) : null}
                      </svg>
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
              <header
                className={`items-center justify-between gap-2 overflow-hidden border-b border-slate-200 bg-[#f7f7f3] px-4 py-4 sm:px-6 sm:py-5 lg:px-10 ${
                  hideHeaderOnMobile ? "hidden md:flex" : "flex"
                }`}
              >
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
                  <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 md:flex">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M20 20l-3.5-3.5" />
                    </svg>
                    <input
                      className="w-48 bg-transparent text-sm text-slate-600 outline-none"
                      placeholder="Search rewards..."
                    />
                  </div>
                  <div className="relative" ref={bellRef}>
                    <button
                      type="button"
                      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
                      onClick={handleBellOpen}
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>
                    {showBell && (
                      <div className="fixed left-4 right-4 top-20 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.12)] md:absolute md:left-auto md:right-0 md:top-12 md:w-80 md:max-h-96">
                        <div className="border-b border-slate-100 px-4 py-3">
                          <p className="text-sm font-bold text-slate-900">Notifications</p>
                        </div>
                        {bellItems.length === 0 ? (
                          <div className="px-4 py-8 text-center text-sm text-slate-400">
                            No notifications yet
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {bellItems.map((item) => (
                              <div
                                key={item.id}
                                className={`px-4 py-3 ${!item.read ? "bg-blue-50/50" : ""}`}
                              >
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
                    )}
                  </div>
                  <Link
                    href="/profile"
                    className="flex min-w-0 items-center gap-2 overflow-hidden rounded-2xl border border-slate-200 bg-white px-2 py-1.5 text-left transition hover:border-slate-300 sm:hidden sm:gap-3 sm:px-3 sm:py-2"
                  >
                    <div className="h-8 w-8 shrink-0 rounded-full bg-[rgb(var(--accent-rgb)/0.3)] sm:h-9 sm:w-9" />
                    <div className="min-w-0 overflow-hidden">
                      <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                      <p className="hidden truncate text-xs text-slate-500 sm:block">{memberLabel}</p>
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

      <MobileBottomNav homeHref="/dashboard" />

      {/* ── Popup Notification ── */}
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
          <p className="mt-2 text-sm text-slate-500">
            Are you sure you want to log out of your account?
          </p>
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
