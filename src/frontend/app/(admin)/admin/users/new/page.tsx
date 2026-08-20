export default function Page() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <header>
        <h1 className="text-2xl font-black text-[#0f172a]">Add New User</h1>
        <p className="text-sm text-slate-500">Create a new customer, agent, or admin account.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="grid gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Full Name</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="John Walker" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Phone Number</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="024 123 4567" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Role</label>
            <select className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <option>Customer</option>
              <option>Agent</option>
              <option>Admin</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Temporary Password</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="••••••••" type="password" />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600">Cancel</button>
          <button className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white">Create User</button>
        </div>
      </section>
    </div>
  );
}
