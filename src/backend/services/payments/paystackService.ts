const PAYSTACK_URL = "https://api.paystack.co";

export const paystackService = {
  async initializePayment(params: {
    orderId: string;
    orderNumber: string;
    amount: number;
    email?: string | null;
    callbackUrl?: string;
  }) {
    const reference = `PAY-${params.orderNumber}-${Date.now()}`;
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    if (secretKey) {
      try {
        const res = await fetch(`${PAYSTACK_URL}/transaction/initialize`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            amount: Math.round(params.amount * 100),
            email: params.email ?? "customer@keldatagh.com",
            reference,
            metadata: {
              orderId: params.orderId,
              orderNumber: params.orderNumber
            },
            callback_url: params.callbackUrl ?? `${baseUrl}/orders?ref=${reference}`
          })
        });
        const data = (await res.json()) as { status?: boolean; data?: { authorization_url?: string } };
        if (data.status && data.data?.authorization_url) {
          return {
            paymentUrl: data.data.authorization_url,
            reference
          };
        }
      } catch {
        /* fallback to mock */
      }
    }

    return {
      paymentUrl: "https://paystack.com/pay/mock",
      reference
    };
  },

  async verifyPayment(reference: string): Promise<{ ok: boolean; orderId?: string }> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (secretKey) {
      try {
        const res = await fetch(
          `${PAYSTACK_URL}/transaction/verify/${encodeURIComponent(reference)}`,
          { headers: { Authorization: `Bearer ${secretKey}` } }
        );
        const data = (await res.json()) as {
          status?: boolean;
          data?: { status?: string; metadata?: { orderId?: string } };
        };
        if (data.status && data.data?.status === "success") {
          return { ok: true, orderId: data.data?.metadata?.orderId };
        }
      } catch {
        /* fallback */
      }
    }
    if (process.env.NODE_ENV !== "production" && reference.startsWith("PAY-")) {
      return { ok: true };
    }
    return { ok: false };
  }
};
