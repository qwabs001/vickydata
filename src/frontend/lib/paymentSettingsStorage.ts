export type PaystackSettings = {
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  mode: "Test" | "Live";
};

export type MoolreSettings = {
  apiUser: string;
  pubKey: string;
  secretKey: string;
  accountNumber: string;
  channel: string;
  currency: string;
};

export type PaymentSettings = {
  paystack: PaystackSettings;
  moolre: MoolreSettings;
};

const STORAGE_KEY = "bundlearena:paymentSettings";
const LEGACY_STORAGE_KEY = `${["kel", "data", "gh"].join("")}:paymentSettings`;

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
  },
};

export const loadPaymentSettings = (): PaymentSettings => {
  if (typeof window === "undefined") return defaultSettings;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const legacyRaw = raw ? null : window.localStorage.getItem(LEGACY_STORAGE_KEY);
  const source = raw ?? legacyRaw;
  if (!source) return defaultSettings;
  try {
    const parsed = JSON.parse(source) as Partial<PaymentSettings>;
    const next = {
      paystack: {
        ...defaultSettings.paystack,
        ...parsed.paystack
      },
      moolre: {
        ...defaultSettings.moolre,
        ...parsed.moolre
      },
    };
    if (legacyRaw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return next;
  } catch {
    window.localStorage.removeItem(raw ? STORAGE_KEY : LEGACY_STORAGE_KEY);
    return defaultSettings;
  }
};

export const savePaymentSettings = (settings: PaymentSettings) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
};
