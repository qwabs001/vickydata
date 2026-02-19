"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/frontend/hooks/useAuth";
import { formatCurrency } from "@/shared/utils/formatters";
import { downloadCsv } from "@/frontend/lib/exportCsv";

type WithdrawalRow = {
  id: string;
  referenceNumber?: string | null;
  user: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
};

export default function Page() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWithdrawals = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/withdrawals", {
        headers: { "x-user-id": user.id }
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to load withdrawals.");
        setRequests([]);
        return;
      }
      setRequests(data?.requests ?? []);
    } catch {
      setError("Unable to load withdrawals.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, [user?.id]);

  const handleApprove = async (id: string) => {
    if (!user?.id) return;
    try {
      const response = await fetch(`/api/admin/withdrawals/${id}/approve`, {
        method: "POST",
        headers: { "x-user-id": user.id }
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to approve withdrawal.");
        return;
      }
      await loadWithdrawals();
    } catch {
      setError("Unable to approve withdrawal.");
    }
  };

  const handleReject = async (id: string) => {
    if (!user?.id) return;
    if (!window.confirm("Reject this withdrawal request?")) return;
    try {
      const response = await fetch(`/api/admin/withdrawals/${id}/reject`, {
        method: "POST",
        headers: { "x-user-id": user.id }
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to reject withdrawal.");
        return;
      }
      await loadWithdrawals();
    } catch {
      setError("Unable to reject withdrawal.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0f172a]">Withdrawal Requests</h1>
          <p className="text-sm text-slate-500">Manage reward withdrawals and payouts.</p>
        </div>
        <button
          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
          onClick={() => {
            const rows = requests.map((request) => ({
              Reference: request.referenceNumber ?? request.id,
              User: request.user,
              Amount: formatCurrency(request.amount, "GHS"),
              Method: request.method === "MOBILE_MONEY" ? "MoMo" : request.method,
              Status: request.status,
              CreatedAt: new Date(request.createdAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })
            }));
            downloadCsv("withdrawals.csv", rows, [
              "Reference",
              "User",
              "Amount",
              "Method",
              "Status",
              "CreatedAt"
            ]);
          }}
        >
          Export
        </button>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-4 text-left">Request ID</th>
                <th className="px-4 py-4 text-left">User</th>
                <th className="px-4 py-4 text-left">Amount</th>
                <th className="px-4 py-4 text-left">Method</th>
                <th className="px-4 py-4 text-left">Status</th>
                <th className="px-4 py-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={6}>
                    {loading ? "Loading withdrawals..." : "No withdrawal requests yet."}
                  </td>
                </tr>
              ) : (
                requests.map((request) => {
                  const label = request.status === "PENDING"
                    ? "Pending"
                    : request.status === "APPROVED"
                    ? "Approved"
                    : request.status === "COMPLETED"
                    ? "Completed"
                    : request.status === "REJECTED"
                    ? "Rejected"
                    : request.status === "FAILED"
                    ? "Failed"
                    : request.status;
                  const badge =
                    label === "Pending"
                      ? "bg-[#fff6dd] text-[#f59e0b]"
                      : label === "Approved" || label === "Completed"
                      ? "bg-[#ecfdf3] text-[#16a34a]"
                      : "bg-[#fee2e2] text-[#ef4444]";
                  const canAct = request.status === "PENDING";
                  return (
                    <tr key={request.id} className="border-t border-slate-100">
                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {request.referenceNumber ?? request.id}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{request.user}</td>
                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {formatCurrency(request.amount, "GHS")}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {request.method === "MOBILE_MONEY" ? "MoMo" : request.method}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge}`}>
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/withdrawals/${request.id}`}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                          >
                            View
                          </Link>
                          <button
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                            onClick={() => handleApprove(request.id)}
                            disabled={!canAct}
                          >
                            Approve
                          </button>
                          <button
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                            onClick={() => handleReject(request.id)}
                            disabled={!canAct}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
