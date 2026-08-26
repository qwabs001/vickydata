import test from "node:test";
import assert from "node:assert/strict";

test("checkout uses server prices, fixed upgrade fee, GHS and Paystack for all types", async () => {
  const intents: any[] = [];
  const requests: any[] = [];
  const db = {
    settings: { findUnique: async ({ where }: any) => where.key === "payment.settings"
      ? { value: { paystack: { secretKey: "sk_test_fake", mode: "Test" } } } : null },
    user: { findUnique: async () => ({ id: "customer", username: "user@example.test", role: "CUSTOMER", status: "ACTIVE" }) },
    dataPlan: { findUnique: async () => ({ id: "plan", networkId: "network", isActive: true, price: 5.2, agentPrice: null, currency: "GHS", network: { isActive: true } }) },
    paymentIntent: { create: async ({ data }: any) => { intents.push(data); return data; }, update: async () => ({}) }
  };
  (globalThis as any).prisma = db;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url, init) => {
    assert.equal(url, "https://api.paystack.co/transaction/initialize");
    const body = JSON.parse(String(init?.body));
    requests.push(body);
    assert.equal(body.currency, "GHS");
    assert.match(body.callback_url, /\/api\/payments\/paystack\/verify-return$/);
    assert.ok(!body.callback_url.includes("attacker.example"));
    return new Response(JSON.stringify({ status: true, data: { authorization_url: "https://checkout.paystack.com/test-only" } }));
  }) as typeof fetch;
  try {
    const { createPaystackCheckout } = await import("../../src/backend/services/payments/paystackCheckoutService");
    const base = { request: new Request("https://attacker.example"), userId: "customer", ref: "client-ref", amount: 1, currency: "GHS" };
    const order = await createPaystackCheckout({ ...base, type: "order", networkId: "network", dataPlanId: "plan", recipientNumber: "0200000000" });
    assert.equal(requests[0].amount, 520);
    assert.equal(intents[0].amount, 5.2);
    assert.equal(intents[0].provider, "PAYSTACK");
    assert.equal(order.provider, "PAYSTACK");
    await createPaystackCheckout({ ...base, type: "agent_upgrade" });
    assert.equal(requests[1].amount, 10000);
    await createPaystackCheckout({ ...base, type: "wallet", amount: 20 });
    assert.equal(requests[2].amount, 2000);
    assert.notEqual(requests[0].reference, base.ref);
    assert.equal(new Set(intents.map(i => i.reference)).size, 3);
    await assert.rejects(() => createPaystackCheckout({ ...base, currency: "NGN" }));
    await assert.rejects(() => createPaystackCheckout({ ...base, type: "order", networkId: "wrong", dataPlanId: "plan", recipientNumber: "0200000000" }));
    assert.equal(requests.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    delete (globalThis as any).prisma;
  }
});
