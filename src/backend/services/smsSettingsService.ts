import { prisma } from "@/backend/lib/db/prisma";

const SMS_SETTINGS_KEY = "sms.settings";

export type AfricasTalkingSettings = {
  username: string;
  apiKey: string;
  sandbox: boolean;
};

export type TermiiSettings = {
  apiKey: string;
  senderId: string;
};

export type SmsSettings = {
  enabled: boolean;
  provider: "africastalking" | "termii";
  africastalking: AfricasTalkingSettings;
  termii: TermiiSettings;
  /** Custom sender name for order complete SMS (e.g. "Keldatagh") */
  orderCompleteTemplate: string;
  /** Custom sender name for wallet top-up SMS */
  walletTopUpTemplate: string;
};

const defaultSettings: SmsSettings = {
  enabled: false,
  provider: "africastalking",
  africastalking: {
    username: "",
    apiKey: "",
    sandbox: true
  },
  termii: {
    apiKey: "",
    senderId: ""
  },
  orderCompleteTemplate: "Your order {{orderNumber}} is complete. {{planName}} has been delivered to {{recipient}}.",
  walletTopUpTemplate: "Your Keldatagh wallet has been credited with GHS {{amount}}. New balance: GHS {{balance}}."
};

export async function getSmsSettings(): Promise<SmsSettings> {
  const setting = await prisma.settings.findUnique({
    where: { key: SMS_SETTINGS_KEY }
  });
  const value = setting?.value as Partial<SmsSettings> | null;
  if (!value) return defaultSettings;
  return {
    ...defaultSettings,
    ...value,
    africastalking: { ...defaultSettings.africastalking, ...value.africastalking },
    termii: { ...defaultSettings.termii, ...value.termii }
  };
}

export async function saveSmsSettings(
  settings: Partial<SmsSettings>,
  updatedBy?: string
): Promise<SmsSettings> {
  const existing = await getSmsSettings();
  const merged: SmsSettings = {
    ...existing,
    ...settings,
    africastalking: settings.africastalking
      ? { ...existing.africastalking, ...settings.africastalking }
      : existing.africastalking,
    termii: settings.termii ? { ...existing.termii, ...settings.termii } : existing.termii
  };
  const value = JSON.parse(JSON.stringify(merged)) as object;
  const base = { value, category: "sms" } as const;
  await prisma.settings.upsert({
    where: { key: SMS_SETTINGS_KEY },
    update: { ...base, ...(updatedBy != null && { updatedBy }) },
    create: { key: SMS_SETTINGS_KEY, ...base, ...(updatedBy != null && { updatedBy }) }
  });
  return merged;
}
