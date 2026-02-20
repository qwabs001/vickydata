"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/frontend/hooks/useAuth";
import { formatCurrency } from "@/shared/utils/formatters";
import { downloadCsv } from "@/frontend/lib/exportCsv";

type UserStatus = "Active" | "Suspended" | "VIP";
type UserRole = "CUSTOMER" | "AGENT" | "ADMIN";

interface UserRow {
  id: string;
  name: string;
  initials: string;
  phone: string;
  role: UserRole;
  joined: string;
  orders: number;
  referrals: number;
  balance: number;
  walletBalance: number;
  walletSpent: number;
  walletAdded: number;
  status: UserStatus;
  isNew: boolean;
  vip: boolean;
}

interface ReferredUser {
  id: string;
  username: string;
  phoneNumber: string;
  createdAt: string;
  ordersCount: number;
  orders: Array<{
    id: string;
    orderNumber: string;
    amount: number;
    status: string;
    network: string;
    plan: string;
    createdAt: string;
  }>;
}

const statusFilters = ["All", "Active", "Suspended", "VIP"] as const;
const PAGE_SIZE = 7;

const statusOptions: UserStatus[] = ["Active", "Suspended", "VIP"];
const roleOptions: UserRole[] = ["CUSTOMER", "AGENT"];

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase();
};

const formatJoined = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const getStatusLabel = (status: string, vip: boolean) => {
  if (status === "SUSPENDED") return "Suspended";
  if (vip) return "VIP";
  return "Active";
};

const shortOrderId = (orderNumber: string) => {
  const cleaned = (orderNumber ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleaned.slice(-5) || "-----";
};

export default function Page() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showReferralsModal, setShowReferralsModal] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [referralsData, setReferralsData] = useState<ReferredUser[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralsUserName, setReferralsUserName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    joined: "",
    orders: "",
    balance: "",
    role: "CUSTOMER" as UserRole,
    status: "Active" as UserStatus,
    rewardsAdjustment: "",
    password: "",
    confirmPassword: ""
  });
  const [walletModalUser, setWalletModalUser] = useState<UserRow | null>(null);
  const [walletAction, setWalletAction] = useState<"credit" | "debit">("credit");
  const [walletAmount, setWalletAmount] = useState("");
  const [walletReason, setWalletReason] = useState("");
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [usersPage, setUsersPage] = useState(1);

  useEffect(() => {
    const loadUsers = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/users?includeAgents=true&limit=300", {
          headers: { "x-user-id": user.id }
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          setError(data?.error ?? "Unable to load users.");
          setUsers([]);
          return;
        }

        const now = Date.now();
        const rows = (data?.users ?? []).map((user: any) => {
          const createdAt = new Date(user.createdAt);
          const isNew = now - createdAt.getTime() < 7 * 24 * 60 * 60 * 1000;
          const status = getStatusLabel(user.status, user.vip);
          const name = user.username ?? user.phoneNumber;
          return {
            id: user.id,
            name,
            initials: getInitials(name),
            phone: user.phoneNumber,
            role: user.role,
            joined: formatJoined(user.createdAt),
            orders: user.ordersCount ?? 0,
            referrals: user.referralsCount ?? 0,
            balance: user.rewardsBalance ?? 0,
            walletBalance: user.walletBalance ?? 0,
            walletSpent: user.walletSpent ?? 0,
            walletAdded: user.walletAdded ?? 0,
            status,
            isNew,
            vip: Boolean(user.vip)
          };
        });
        setUsers(rows);
      } catch {
        setError("Unable to load users.");
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [user?.id]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((user) => user.status === "Active" || user.status === "VIP").length;
    const suspended = users.filter((user) => user.status === "Suspended").length;
    const newThisWeek = users.filter((user) => user.isNew).length;
    return [
      { label: "Total Users", value: total.toLocaleString("en-US"), accent: "bg-[#e7efff] text-[#2563eb]" },
      { label: "Active", value: active.toLocaleString("en-US"), accent: "bg-[#ecfdf3] text-[#16a34a]" },
      { label: "Suspended", value: suspended.toLocaleString("en-US"), accent: "bg-[#fee2e2] text-[#ef4444]" },
      { label: "New This Week", value: newThisWeek.toLocaleString("en-US"), accent: "bg-[#fff6dd] text-[#f59e0b]" }
    ];
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.phone.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "All" || user.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, users]);

  const usersTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE)),
    [filteredUsers.length]
  );
  const visibleUsers = useMemo(() => {
    const start = (usersPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, usersPage]);

  useEffect(() => {
    setUsersPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-user-actions]")) {
        setActionMenuId(null);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  const openEdit = (user: UserRow) => {
    setEditForm({
      name: user.name,
      phone: user.phone,
      joined: user.joined,
      orders: user.orders.toString(),
      balance: user.balance.toFixed(2),
      role: user.role,
      status: user.status,
      rewardsAdjustment: "",
      password: "",
      confirmPassword: ""
    });
    setEditingId(user.id);
    setActionMenuId(null);
  };

  const closeEdit = () => {
    setEditingId(null);
    setActionMenuId(null);
  };

  const openReferrals = async (row: UserRow) => {
    setActionMenuId(null);
    setReferralsUserName(row.name);
    setShowReferralsModal(true);
    setReferralsData([]);
    setReferralsLoading(true);
    try {
      const res = await fetch(`/api/users/${row.id}/referrals`, {
        headers: { "x-user-id": user?.id ?? "" }
      });
      const data = await res.json().catch(() => null);
      if (res.ok) setReferralsData(data?.referrals ?? []);
      else setReferralsData([]);
    } catch {
      setReferralsData([]);
    } finally {
      setReferralsLoading(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingId) return;
    if (editForm.password && editForm.password !== editForm.confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }
    const rewardsAdjustment = Number(editForm.rewardsAdjustment || 0);
    if (!Number.isFinite(rewardsAdjustment)) {
      setError("Rewards adjustment must be a valid number.");
      return;
    }
    const payload = {
      username: editForm.name.trim(),
      phoneNumber: editForm.phone.trim(),
      role: editForm.role,
      status: editForm.status === "Suspended" ? "SUSPENDED" : "ACTIVE",
      vip: editForm.status === "VIP",
      password: editForm.password || undefined,
      rewardsAdjustment: rewardsAdjustment || undefined
    };

    try {
      const response = await fetch(`/api/users/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": user?.id ?? "" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to update user.");
        return;
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === editingId
            ? {
                ...user,
                name: payload.username || user.name,
                phone: payload.phoneNumber || user.phone,
                role: payload.role,
                status: editForm.status,
                vip: editForm.status === "VIP",
                initials: getInitials(payload.username || user.name),
                balance: data?.rewardsBalance ?? user.balance
              }
            : user
        )
      );
      setEditingId(null);
    } catch {
      setError("Unable to update user.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setActionMenuId(null);
    if (!window.confirm(`Delete ${name}? This will deactivate the user.`)) {
      return;
    }
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: { "x-user-id": user?.id ?? "" }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Unable to delete user.");
        return;
      }
      setUsers((prev) => prev.filter((user) => user.id !== id));
    } catch {
      setError("Unable to delete user.");
    }
  };

  const handleImpersonate = async (targetId: string, targetName: string) => {
    if (!user?.id) return;
    if (!window.confirm(`Impersonate ${targetName}?`)) return;

    setActionMenuId(null);
    setImpersonatingId(targetId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${targetId}/impersonate`, {
        method: "POST",
        headers: { "x-user-id": user.id }
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.user) {
        setError(data?.error ?? "Unable to impersonate user.");
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "keldatagh.auth.adminBackup",
          JSON.stringify({
            id: user.id,
            username: user.username,
            phoneNumber: user.phoneNumber,
            role: user.role
          })
        );
      }

      login(data.user);
      router.push(data?.redirectTo ?? "/dashboard");
    } catch {
      setError("Unable to impersonate user.");
    } finally {
      setImpersonatingId(null);
    }
  };

  const openWalletModal = (row: UserRow) => {
    setActionMenuId(null);
    setWalletModalUser(row);
    setWalletAction("credit");
    setWalletAmount("");
    setWalletReason("");
    setWalletError(null);
    setWalletSubmitting(false);
  };

  const closeWalletModal = () => {
    setWalletModalUser(null);
  };

  const handleWalletSubmit = async () => {
    if (!walletModalUser) return;
    const amount = Number(walletAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setWalletError("Enter a valid amount.");
      return;
    }
    setWalletError(null);
    setWalletSubmitting(true);
    try {
      const response = await fetch(`/api/users/${walletModalUser.id}/wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user?.id ?? "" },
        body: JSON.stringify({
          action: walletAction,
          amount,
          reason: walletReason.trim() || undefined
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setWalletError(data?.error ?? "Unable to update wallet.");
        setWalletSubmitting(false);
        return;
      }
      setUsers((prev) =>
        prev.map((row) =>
          row.id === walletModalUser.id
            ? {
                ...row,
                walletBalance: data.walletBalance ?? row.walletBalance,
                walletAdded: data.walletAdded ?? row.walletAdded,
                walletSpent: data.walletSpent ?? row.walletSpent
              }
            : row
        )
      );
      setWalletSubmitting(false);
      setWalletModalUser(null);
    } catch {
      setWalletError("Unable to update wallet.");
      setWalletSubmitting(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-[#0f172a] sm:text-2xl">Customers</h1>
          <p className="text-sm text-slate-500">Manage users and promoted agents in one list</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
            onClick={() => {
              const rows = filteredUsers.map((user) => ({
                Name: user.name,
                Phone: user.phone,
                Status: user.status,
                Joined: user.joined,
                Orders: user.orders,
                Referrals: user.referrals,
                RewardsBalance: user.balance.toFixed(2),
                WalletBalance: user.walletBalance.toFixed(2),
                WalletSpent: user.walletSpent.toFixed(2),
                WalletAdded: user.walletAdded.toFixed(2),
                VIP: user.vip ? "Yes" : "No"
              }));
              downloadCsv("customers.csv", rows, [
                "Name",
                "Phone",
                "Status",
                "Joined",
                "Orders",
                "Referrals",
                "RewardsBalance",
                "WalletBalance",
                "WalletSpent",
                "WalletAdded",
                "VIP"
              ]);
            }}
          >
            Export
          </button>
          <Link href="/admin/users/new" className="rounded-full bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white">
            Add User
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:p-5">
            <p className="text-xs text-slate-500 sm:text-sm">{stat.label}</p>
            <div className="mt-2 flex items-center justify-between sm:mt-3">
              <span className="text-lg font-black text-[#0f172a] sm:text-2xl">{stat.value}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:px-3 sm:py-1 sm:text-xs ${stat.accent}`}>Live</span>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-[#f8fafc] px-4 py-2 text-sm text-slate-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              className="w-full bg-transparent text-sm text-slate-600 outline-none placeholder:text-slate-400"
              placeholder="Search by name or phone number..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as (typeof statusFilters)[number])}
          >
            {statusFilters.map((filter) => (
              <option key={filter} value={filter}>
                Status: {filter}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100 sm:mt-5">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-4 text-left">User</th>
                <th className="px-4 py-4 text-left">Joined</th>
                <th className="px-4 py-4 text-left">Orders</th>
                <th className="px-4 py-4 text-left">Referrals</th>
                <th className="px-4 py-4 text-left">Wallet Balance</th>
                <th className="px-4 py-4 text-left">Wallet Spent</th>
                <th className="px-4 py-4 text-left">Rewards Balance</th>
                <th className="px-4 py-4 text-left">Status</th>
                <th className="px-4 py-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                    {loading ? "Loading customers..." : "No customers found."}
                  </td>
                </tr>
              ) : (
                visibleUsers.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e7efff] text-xs font-semibold text-[#2563eb]">
                          {user.initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                            {user.role === "AGENT" ? (
                              <span className="rounded-full bg-[#e7efff] px-2 py-0.5 text-[10px] font-semibold text-[#2563eb]">Agent</span>
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-500">{user.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-500">{user.joined}</td>
                    <td className="px-4 py-4 text-slate-700">{user.orders}</td>
                    <td className="px-4 py-4">
                      {user.referrals > 0 ? (
                        <button
                          type="button"
                          onClick={() => openReferrals(user)}
                          className="rounded-full bg-[#e7efff] px-3 py-1 text-xs font-semibold text-[#2563eb] hover:bg-[#dbeafe]"
                        >
                          {user.referrals}
                        </button>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-900 font-semibold">
                      {formatCurrency(user.walletBalance, "GHS")}
                    </td>
                    <td className="px-4 py-4 text-slate-900 font-semibold">
                      {formatCurrency(user.walletSpent, "GHS")}
                    </td>
                    <td className="px-4 py-4 text-slate-900 font-semibold">
                      {formatCurrency(user.balance, "GHS")}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        user.status === "Active"
                          ? "bg-[#ecfdf3] text-[#16a34a]"
                          : user.status === "VIP"
                          ? "bg-[#fff6dd] text-[#f59e0b]"
                          : "bg-[#fee2e2] text-[#ef4444]"
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative inline-flex" data-user-actions>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                          onClick={() => setActionMenuId((current) => (current === user.id ? null : user.id))}
                          aria-label="Open customer actions"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.8 1.8 0 0 0 0-6l-1.1-.3a6.6 6.6 0 0 0-1.1-1.9l.6-1a1.8 1.8 0 0 0-2.5-2.5l-1 .6a6.6 6.6 0 0 0-1.9-1.1L12 1.6 9.6 2.8a6.6 6.6 0 0 0-1.9 1.1l-1-.6A1.8 1.8 0 0 0 4.2 5.8l.6 1a6.6 6.6 0 0 0-1.1 1.9L2.6 9a1.8 1.8 0 0 0 0 6l1.1.3a6.6 6.6 0 0 0 1.1 1.9l-.6 1a1.8 1.8 0 0 0 2.5 2.5l1-.6a6.6 6.6 0 0 0 1.9 1.1l2.4 1.2 2.4-1.2a6.6 6.6 0 0 0 1.9-1.1l1 .6a1.8 1.8 0 0 0 2.5-2.5l-.6-1a6.6 6.6 0 0 0 1.1-1.9z" />
                          </svg>
                        </button>
                        {actionMenuId === user.id ? (
                          <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                            <button
                              className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              onClick={() => openEdit(user)}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              onClick={() => openWalletModal(user)}
                              type="button"
                            >
                              Wallet
                            </button>
                            <button
                              className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#1d4ed8] hover:bg-[#eff6ff] disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => handleImpersonate(user.id, user.name)}
                              disabled={impersonatingId === user.id || user.status === "Suspended"}
                              type="button"
                            >
                              {impersonatingId === user.id ? "Opening..." : "Impersonate"}
                            </button>
                            <button
                              className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
                              onClick={() => handleDelete(user.id, user.name)}
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredUsers.length > PAGE_SIZE ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-[#f8fafc] px-4 py-3">
            <p className="text-sm text-slate-600">
              Showing {(usersPage - 1) * PAGE_SIZE + 1}–{Math.min(usersPage * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                disabled={usersPage <= 1}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {usersPage} of {usersTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                disabled={usersPage >= usersTotalPages}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {showReferralsModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-[#0f172a]">Referrals by {referralsUserName}</h2>
                <p className="text-xs text-slate-500">People who signed up using this user&apos;s referral link</p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={() => setShowReferralsModal(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-6">
              {referralsLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">Loading referrals...</p>
              ) : referralsData.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No referrals yet.</p>
              ) : (
                <div className="space-y-6">
                  {referralsData.map((ref) => (
                    <div key={ref.id} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{ref.username || ref.phoneNumber}</p>
                          <p className="text-xs text-slate-500">{ref.phoneNumber}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            Joined {formatJoined(ref.createdAt)} · {ref.ordersCount} order{ref.ordersCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      {ref.orders.length > 0 ? (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase text-slate-500">Orders</p>
                          <div className="mt-2 space-y-2">
                            {ref.orders.map((o) => (
                              <div
                                key={o.id}
                                className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm"
                              >
                                <div>
                                  <span className="font-medium text-slate-700" title={o.orderNumber}>
                                    #{shortOrderId(o.orderNumber)}
                                  </span>
                                  <span className="ml-2 text-slate-500">{o.plan}</span>
                                </div>
                                <span className="font-semibold text-slate-900">
                                  {formatCurrency(o.amount, "GHS")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {editingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0f172a]">Edit Customer</h2>
                <p className="text-xs text-slate-500">Update user details.</p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={closeEdit}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4">
              <label className="text-xs font-semibold text-slate-500">
                Username
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Phone
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                  value={editForm.phone}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="text-xs font-semibold text-slate-500">
                  Orders
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-400"
                    value={editForm.orders}
                    readOnly
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Rewards Balance
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-400"
                    value={editForm.balance}
                    readOnly
                  />
                </label>
              </div>
              <label className="text-xs font-semibold text-slate-500">
                Role
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                  value={editForm.role}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value as UserRole }))}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Status
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                  value={editForm.status}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value as UserStatus }))}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Rewards Count Adjustment (+ / -)
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                  value={editForm.rewardsAdjustment}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, rewardsAdjustment: event.target.value }))}
                  placeholder="e.g. 10 or -5"
                />
              </label>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold text-slate-500">
                  Reset Password
                  <input
                    type="password"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                    value={editForm.password}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="Leave empty to keep current"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Confirm Password
                  <input
                    type="password"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                    value={editForm.confirmPassword}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    placeholder="Confirm new password"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                onClick={closeEdit}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white"
                onClick={handleEditSave}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {walletModalUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0f172a]">Adjust Wallet</h2>
                <p className="text-xs text-slate-500">
                  {walletModalUser.name} • {walletModalUser.phone}
                </p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={closeWalletModal}
                type="button"
                disabled={walletSubmitting}
              >
                Close
              </button>
            </div>

            {walletError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {walletError}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4">
              <label className="text-xs font-semibold text-slate-500">
                Action
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                  value={walletAction}
                  onChange={(event) => setWalletAction(event.target.value as "credit" | "debit")}
                  disabled={walletSubmitting}
                >
                  <option value="credit">Add funds</option>
                  <option value="debit">Remove funds</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Amount (GHS)
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                  value={walletAmount}
                  onChange={(event) => setWalletAmount(event.target.value)}
                  placeholder="10.00"
                  disabled={walletSubmitting}
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Reason (optional)
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#2563eb]"
                  value={walletReason}
                  onChange={(event) => setWalletReason(event.target.value)}
                  placeholder="Manual adjustment"
                  disabled={walletSubmitting}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                onClick={closeWalletModal}
                disabled={walletSubmitting}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white disabled:opacity-70"
                onClick={handleWalletSubmit}
                disabled={walletSubmitting}
              >
                {walletSubmitting ? "Updating..." : "Apply"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
