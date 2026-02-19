import { Card } from "@/frontend/components/ui/card";
import type { DataPlan, Network } from "@/shared/types";
import { formatCurrency } from "@/shared/utils/formatters";

interface OrderSummaryProps {
  network?: Network | null;
  plan?: DataPlan | null;
  recipientNumber?: string;
}

export function OrderSummary({
  network,
  plan,
  recipientNumber
}: OrderSummaryProps) {
  const amount = plan?.price ?? 0;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Order Summary</h3>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Step 4
        </span>
      </div>
      <div className="mt-4 space-y-2 text-sm text-slate-700">
        <div className="flex items-center justify-between">
          <span>Network</span>
          <span className="font-semibold">
            {network?.displayName ?? "Select network"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Data</span>
          <span className="font-semibold">
            {plan ? plan.dataAmount : "Select plan"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Number</span>
          <span className="font-semibold">
            {recipientNumber?.trim() ? recipientNumber : "Enter phone"}
          </span>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Total
        </p>
        <p className="mt-1 text-2xl font-bold text-slate-900">
          {formatCurrency(amount, plan?.currency ?? "GHS")}
        </p>
      </div>
    </Card>
  );
}
