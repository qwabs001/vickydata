const PAYSTACK_URL = "https://api.paystack.co";
const FALLBACK_PAYSTACK_EMAIL = "customer@keldatagh.com";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const resolvePaystackEmail = (value?: string | null) => {
  const candidate = (value ?? "").trim().toLowerCase();
  if (isValidEmail(candidate)) return candidate;

  const localPart = candidate
    .replace(/[^a-z0-9._+-]/g, "")
    .replace(/^[._+-]+|[._+-]+$/g, "")
    .slice(0, 64);

  return localPart ? `${localPart}@keldatagh.com` : FALLBACK_PAYSTACK_EMAIL;
};

export const paystackService = {
  async initializePayment(params: {
    orderId: string;
    orderNumber: string;
    amount: number;
    email?: string | null;
    callbackUrl?: string;
    secretKey?: string;
  }) {
    const reference = `PAY-${params.orderNumber}-${Date.now()}`;
    const secretKey = params.secretKey || process.env.PAYSTACK_SECRET_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    if (!secretKey) {
      throw new Error("Paystack secret key not configured. Please configure Paystack in Admin → Payment Settings.");
    }

    const safeEmail = resolvePaystackEmail(params.email);

    try {
      const res = await fetch(`${PAYSTACK_URL}/transaction/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: Math.round(params.amount * 100),
          email: safeEmail,
          reference,
          metadata: {
            orderId: params.orderId,
            orderNumber: params.orderNumber
          },
          callback_url: params.callbackUrl ?? `${baseUrl}/orders?ref=${reference}`
        })
      });
      
      const data = (await res.json()) as { 
        status?: boolean; 
        data?: { authorization_url?: string }; 
        message?: string;
        errors?: any;
      };
      
      console.log("[Paystack Service] Response status:", res.status);
      console.log("[Paystack Service] Response data:", JSON.stringify(data, null, 2));
      
      if (!res.ok) {
        const errorMsg = data.message || `Paystack API returned status ${res.status}`;
        console.error("[Paystack Service] API error:", errorMsg, data.errors);
        throw new Error(errorMsg);
      }
      
      if (data.status && data.data?.authorization_url) {
        return {
          paymentUrl: data.data.authorization_url,
          reference
        };
      }
      
      const errorMsg = data.message || "Paystack did not return a payment URL";
      console.error("[Paystack Service] Missing payment URL:", errorMsg, data);
      throw new Error(errorMsg);
    } catch (error) {
      console.error("[Paystack Service] Initialize error:", error);
      throw error instanceof Error ? error : new Error("Failed to initialize payment");
    }
  },

  async verifyPayment(
    reference: string,
    secretKeyOverride?: string | null
  ): Promise<{ ok: boolean; orderId?: string; message?: string }> {
    const secretKey = secretKeyOverride ?? process.env.PAYSTACK_SECRET_KEY ?? "";
    if (!secretKey) {
      console.error("[Paystack verify] No secret key (use Admin Payment Settings or PAYSTACK_SECRET_KEY)");
      return { ok: false, message: "Paystack not configured" };
    }
    try {
      const res = await fetch(
        `${PAYSTACK_URL}/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${secretKey}` } }
      );
      const data = (await res.json()) as {
        status?: boolean;
        message?: string;
        data?: { status?: string; metadata?: { orderId?: string } };
      };
      if (data.status && data.data?.status === "success") {
        return { ok: true, orderId: data.data?.metadata?.orderId };
      }
      console.warn("[Paystack verify] Unexpected response:", res.status, data.message ?? data);
      return { ok: false, message: data.message ?? "Verification failed" };
    } catch (err) {
      console.error("[Paystack verify] Request error:", err);
      return { ok: false, message: err instanceof Error ? err.message : "Verification request failed" };
    }
  }
};
