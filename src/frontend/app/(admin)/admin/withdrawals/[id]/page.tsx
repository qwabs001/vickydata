export default function Page() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-black text-[#0f172a]">Withdrawal #WD-102</h1>
        <p className="text-sm text-slate-500">Review withdrawal request details.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { label: "User", value: "Ama Appiah" },
            { label: "Amount", value: "GHS 200.00" },
            { label: "Method", value: "Mobile Money" },
            { label: "Status", value: "Pending" }
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-100 bg-[#f8fafc] p-4">
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          <button className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600">Reject</button>
          <button className="rounded-full bg-[#16a34a] px-5 py-2 text-sm font-semibold text-white">Approve</button>
        </div>
      </section>
    </div>
  );
}
