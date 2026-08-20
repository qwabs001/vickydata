export default function Page() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-black text-[#0f172a]">Rewards Configuration</h1>
        <p className="text-sm text-slate-500">Control reward percentages and withdrawal rules.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-700">Reward Percentage</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="1.0" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Min Purchase Amount</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="0" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Max Reward Per Order</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="50" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Min Withdrawal Amount</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="5" />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600">Cancel</button>
          <button className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white">Save Settings</button>
        </div>
      </section>
    </div>
  );
}
