"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/frontend/hooks/useAuth";
import { downloadCsv } from "@/frontend/lib/exportCsv";

const filters = ["All", "Orders", "Payments", "Settings", "System"] as const;

export default function Page() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [logs, setLogs] = useState<
    { user: string; action: string; resource: string; time: string; category: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLogs = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/activity-logs", {
          headers: { "x-user-id": user.id }
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          setError(data?.error ?? "Unable to load activity logs.");
          setLogs([]);
          return;
        }
        setLogs(data?.logs ?? []);
      } catch {
        setError("Unable to load activity logs.");
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [user?.id]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesSearch =
        !query ||
        log.user.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.resource.toLowerCase().includes(query);
      const matchesFilter = filter === "All" || log.category === filter;
      return matchesSearch && matchesFilter;
    });
  }, [search, filter]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0f172a]">Activity Logs</h1>
          <p className="text-sm text-slate-500">Track important system and admin actions.</p>
        </div>
        <button
          className="rounded-full bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white"
          onClick={() => {
            const rows = filteredLogs.map((log) => ({
              User: log.user,
              Action: log.action,
              Resource: log.resource,
              Category: log.category,
              Time: new Date(log.time).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })
            }));
            downloadCsv("activity-logs.csv", rows, [
              "User",
              "Action",
              "Resource",
              "Category",
              "Time"
            ]);
          }}
        >
          Export Logs
        </button>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-[#f8fafc] px-4 py-2 text-sm text-slate-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              className="w-full bg-transparent text-sm text-slate-600 outline-none placeholder:text-slate-400"
              placeholder="Search by user or action..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">Date Range</button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Quick Filters:</span>
          {filters.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                item === filter
                  ? "bg-[#2563eb] text-white"
                  : "bg-[#f1f5f9] text-slate-600"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-4 text-left">User</th>
                <th className="px-4 py-4 text-left">Action</th>
                <th className="px-4 py-4 text-left">Resource</th>
                <th className="px-4 py-4 text-left">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={4}>
                    {loading ? "Loading logs..." : "No logs match your filters."}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.time + log.resource} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-semibold text-slate-700">{log.user}</td>
                    <td className="px-4 py-4 text-slate-600">{log.action}</td>
                    <td className="px-4 py-4 text-slate-600">{log.resource}</td>
                    <td className="px-4 py-4 text-slate-500">
                      {new Date(log.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
