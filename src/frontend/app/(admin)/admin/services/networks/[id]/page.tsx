export default function Page() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-black text-[#0f172a]">Edit Network</h1>
        <p className="text-sm text-slate-500">Update network details and API settings.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-700">Network Name</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="MTN" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Display Name</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="MTN Ghana" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Logo Upload</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" type="file" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Status</label>
            <select className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-600">API Configuration</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="MTN" />
            <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="****************" />
            <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="****************" />
            <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" defaultValue="https://api.mtn.com.gh" />
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
