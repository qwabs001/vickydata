export default function Page() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-black text-[#0f172a]">Edit Data Plan</h1>
        <p className="text-sm text-slate-500">Update pricing and plan details.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-700">Network</label>
            <select className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="MTN Ghana">
              <option>MTN Ghana</option>
              <option>Telecel Ghana</option>
              <option>AirtelTigo Ghana</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Plan Name</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="5GB" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Data Amount (MB)</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="5120" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Price (GHS)</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="25.00" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Validity</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="15 days" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Featured</label>
            <select className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <option>Yes</option>
              <option>No</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600">Cancel</button>
          <button className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white">Save Changes</button>
        </div>
      </section>
    </div>
  );
}
