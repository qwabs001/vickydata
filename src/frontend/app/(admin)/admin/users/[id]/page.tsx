const recentOrders = [
  { id: "#GB-9831", date: "Oct 24", amount: "GHS 120.00", status: "Completed" },
  { id: "#GB-9828", date: "Oct 21", amount: "GHS 25.00", status: "Completed" },
  { id: "#GB-9822", date: "Oct 18", amount: "GHS 65.00", status: "Failed" }
];

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Customer Profile</p>
          <h1 className="text-2xl font-black text-[#0f172a]">John Walker</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">Reset Password</button>
          <button className="rounded-full bg-[#ef4444] px-4 py-2 text-xs font-semibold text-white">Suspend</button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-slate-200" />
            <div>
              <p className="text-sm font-semibold text-[#0f172a]">John Walker</p>
              <p className="text-xs text-slate-500">024 123 4567</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Status</span>
              <span className="rounded-full bg-[#ecfdf3] px-3 py-1 text-xs font-semibold text-[#16a34a]">Active</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Joined</span>
              <span className="font-semibold text-slate-700">Sep 12, 2023</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Orders</span>
              <span className="font-semibold text-slate-700">12</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Rewards Balance</span>
              <span className="font-semibold text-slate-700">GHS 45.00</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <h2 className="text-lg font-bold text-[#0f172a]">Recent Orders</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Order</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-700">{order.id}</td>
                    <td className="px-4 py-3 text-slate-600">{order.date}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{order.amount}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${order.status === "Completed" ? "bg-[#ecfdf3] text-[#16a34a]" : "bg-[#fee2e2] text-[#ef4444]"}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
