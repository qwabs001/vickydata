const timeline = [
  { label: "Order placed", time: "Oct 24, 2023 • 14:02" },
  { label: "Payment verified", time: "Oct 24, 2023 • 14:03" },
  { label: "Processing network delivery", time: "Oct 24, 2023 • 14:04" },
  { label: "Order completed", time: "Oct 24, 2023 • 14:06" }
];

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Order Details</p>
          <h1 className="text-2xl font-black text-[#0f172a]">#GB-9821</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">Refund</button>
          <button className="rounded-full bg-[#16a34a] px-4 py-2 text-xs font-semibold text-white">Mark Complete</button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <h2 className="text-lg font-bold text-[#0f172a]">Order Summary</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[
              { label: "Customer", value: "John Walker" },
              { label: "Phone", value: "024 123 4567" },
              { label: "Network", value: "MTN Ghana" },
              { label: "Plan", value: "10GB Data Bundle" },
              { label: "Payment Status", value: "Paid" },
              { label: "Amount", value: "GHS 120.00" }
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-[#f8fafc] p-4">
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-600">API Logs</h3>
            <div className="mt-3 rounded-xl border border-slate-100 bg-[#f8fafc] p-4 text-xs text-slate-500">
              Purchase request sent to MTN API. Response: success. Transaction ID: MTN-009821.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <h2 className="text-lg font-bold text-[#0f172a]">Order Timeline</h2>
          <div className="mt-4 space-y-4">
            {timeline.map((event) => (
              <div key={event.label} className="flex items-start gap-3">
                <span className="mt-1 h-3 w-3 rounded-full bg-[#2563eb]" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">{event.label}</p>
                  <p className="text-xs text-slate-400">{event.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
