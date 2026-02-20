export function WelcomeSection() {
  return (
    <section className="text-left">
      <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        Instant Delivery
      </div>
      <h1 className="text-5xl font-black leading-[1.1] tracking-tight text-[#0d131c] md:text-6xl">
        WELCOME TO <span className="text-primary">GHBUNDLE</span>
      </h1>
      <p className="text-lg font-medium text-gray-600">
        The fastest way to top up your mobile data in Ghana. Secure, instant, and reliable.
      </p>
      <div className="flex gap-4">
        <button className="h-14 rounded-xl bg-primary px-8 text-lg font-bold text-white shadow-xl shadow-primary/25 transition-all hover:translate-y-[-2px] active:translate-y-0">
          Get Started Now
        </button>
      </div>
    </section>
  );
}
