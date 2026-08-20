import { prisma } from "@/backend/lib/db/prisma";

const PAYMENT_SETTINGS_KEY = "payment.settings";

export type MoolreSettings = {
  apiUser: string;
  pubKey: string;
  secretKey: string;
  accountNumber: string;
  channel: string;
  currency: string;
};

export type PaystackSettings = {
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  mode: "Test" | "Live";
};

export type PaymentSettings = {
  paystack: PaystackSettings;
  moolre: MoolreSettings;
};

const defaultSettings: PaymentSettings = {
  paystack: {
    publicKey: "",
    secretKey: "",
    webhookSecret: "",
    mode: "Test"
  },
  moolre: {
    apiUser: "",
    pubKey: "",
    secretKey: "",
    accountNumber: "",
    channel: "13",
    currency: "GHS"
  }
};

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const setting = await prisma.settings.findUnique({
    where: { key: PAYMENT_SETTINGS_KEY }
  });
  const value = setting?.value as Partial<PaymentSettings> | null;
  if (!value) return defaultSettings;
  return {
    paystack: { ...defaultSettings.paystack, ...value.paystack },
    moolre: { ...defaultSettings.moolre, ...value.moolre }
  };
}

export async function savePaymentSettings(
  settings: Partial<PaymentSettings>,
  updatedBy?: string
): Promise<PaymentSettings> {
  const existing = await getPaymentSettings();
  const merged: PaymentSettings = {
    paystack: { ...existing.paystack, ...settings.paystack },
    moolre: { ...existing.moolre, ...settings.moolre }
  };
  const value = JSON.parse(JSON.stringify(merged)) as object;
  const base = { value, category: "payment" } as const;
  await prisma.settings.upsert({
    where: { key: PAYMENT_SETTINGS_KEY },
    update: { ...base, ...(updatedBy != null && { updatedBy }) },
    create: { key: PAYMENT_SETTINGS_KEY, ...base, ...(updatedBy != null && { updatedBy }) }
  });
  return merged;
}
