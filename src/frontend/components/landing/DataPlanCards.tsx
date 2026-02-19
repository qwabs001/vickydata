import { useEffect, useMemo, useState } from "react";
import { Card } from "@/frontend/components/ui/card";
import { cn } from "@/frontend/components/ui/utils";
import type { DataPlan } from "@/shared/types";

const tierLabels: Record<string, string> = {
  "2GB": "Standard",
  "5GB": "Popular",
  "10GB": "Power",
  "15GB": "Elite"
};

interface DataPlanCardsProps {
  plans: DataPlan[];
  selectedId?: string | null;
  onSelect: (plan: DataPlan) => void;
}

export function DataPlanCards({
  plans,
  selectedId,
  onSelect
}: DataPlanCardsProps) {
  const [showAll, setShowAll] = useState(false);
  const initialCount = 4;

  const visiblePlans = useMemo(() => {
    if (showAll) return plans;
    return plans.slice(0, initialCount);
  }, [plans, showAll]);

  const showToggle = plans.length > initialCount;

  if (plans.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Select a network to view available plans.
      </section>
    );
  }

  return (
    <section>
      <div
        className={cn(
          "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4",
          showAll ? "max-h-[320px] overflow-y-auto pr-1 md:max-h-[420px]" : ""
        )}
      >
        {visiblePlans.map((plan) => {
          const selected = plan.id === selectedId;
          const tierLabel = tierLabels[plan.dataAmount] ?? plan.name;
          return (
            <Card
              key={plan.id}
              className={cn(
                "group relative flex cursor-pointer flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 transition-all shadow-sm dark:border-gray-700 dark:bg-gray-800 md:rounded-xl",
                plan.isFeatured
                  ? "border-2 border-primary/80 hover:shadow-md"
                  : "hover:border-primary/40",
                selected ? "border-primary ring-2 ring-primary/15" : ""
              )}
              onClick={() => onSelect(plan)}
            >
              {selected ? (
                <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  ✓
                </span>
              ) : null}
              {plan.isFeatured ? (
                <span className="absolute right-2 top-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[9px] font-black uppercase text-[#0f172a]">
                  Most Popular
                </span>
              ) : null}
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {tierLabel}
              </span>
              <span className="text-base font-black text-primary transition-transform md:text-lg md:group-hover:scale-110">
                {plan.dataAmount}
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  GHS {plan.price.toFixed(2)}
                </p>
                <p className="text-[10px] font-medium text-emerald-600">No Expiry</p>
              </div>
            </Card>
          );
        })}
      </div>
      {showToggle ? (
        <div className="mt-3 flex items-center justify-center">
          <button
            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
            onClick={() => setShowAll((prev) => !prev)}
            type="button"
          >
            {showAll ? "Show Less" : "More Plans"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
