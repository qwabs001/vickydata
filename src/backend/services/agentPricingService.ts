import { prisma } from "@/backend/lib/db/prisma";

const AGENT_PRICING_SETTINGS_KEY = "agent.pricing";
const MAX_DISCOUNT_PERCENT = 95;

export type AgentPricingSettings = {
  discountPercent: number;
};

type AgentPricingContext = {
  isAgent: boolean;
  discountPercent: number;
};

const defaultAgentPricingSettings: AgentPricingSettings = {
  discountPercent: 0
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeAgentPrice(value: unknown): number | null {
  if (value == null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return roundMoney(numeric);
}

function normalizeDiscountPercent(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > MAX_DISCOUNT_PERCENT) return MAX_DISCOUNT_PERCENT;
  return roundMoney(numeric);
}

export function applyAgentDiscount(basePrice: number, discountPercent: number): number {
  const safeBase = Number.isFinite(basePrice) ? Math.max(0, basePrice) : 0;
  const safeDiscount = normalizeDiscountPercent(discountPercent);
  return roundMoney(safeBase * (1 - safeDiscount / 100));
}

export function resolveAgentPrice(
  basePrice: number,
  agentPrice: number | null | undefined,
  discountPercent: number
): number {
  const manualAgentPrice = normalizeAgentPrice(agentPrice);
  if (manualAgentPrice != null) return manualAgentPrice;
  return applyAgentDiscount(basePrice, discountPercent);
}

export async function getAgentPricingSettings(): Promise<AgentPricingSettings> {
  const setting = await prisma.settings.findUnique({
    where: { key: AGENT_PRICING_SETTINGS_KEY }
  });
  const value = (setting?.value as Partial<AgentPricingSettings> | null) ?? null;
  return {
    discountPercent: normalizeDiscountPercent(value?.discountPercent)
  };
}

export async function saveAgentPricingSettings(
  input: Partial<AgentPricingSettings>,
  updatedBy?: string
): Promise<AgentPricingSettings> {
  const existing = await getAgentPricingSettings();
  const merged: AgentPricingSettings = {
    discountPercent: normalizeDiscountPercent(
      input.discountPercent ?? existing.discountPercent ?? defaultAgentPricingSettings.discountPercent
    )
  };

  const value = JSON.parse(JSON.stringify(merged)) as object;
  const base = { value, category: "pricing" } as const;

  await prisma.settings.upsert({
    where: { key: AGENT_PRICING_SETTINGS_KEY },
    update: { ...base, ...(updatedBy != null && { updatedBy }) },
    create: { key: AGENT_PRICING_SETTINGS_KEY, ...base, ...(updatedBy != null && { updatedBy }) }
  });

  return merged;
}

export async function getAgentPricingContext(userId?: string | null): Promise<AgentPricingContext> {
  if (!userId) {
    return { isAgent: false, discountPercent: 0 };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  if (!user || user.role !== "AGENT") {
    return { isAgent: false, discountPercent: 0 };
  }

  const settings = await getAgentPricingSettings();
  return {
    isAgent: true,
    discountPercent: settings.discountPercent
  };
}

export async function resolvePriceForUser(
  basePrice: number,
  userId?: string | null,
  agentPrice?: number | null
): Promise<number> {
  const context = await getAgentPricingContext(userId);
  if (!context.isAgent) return roundMoney(basePrice);
  return resolveAgentPrice(basePrice, agentPrice, context.discountPercent);
}
