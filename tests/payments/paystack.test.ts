import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { validPaystackSignature, matchesPaystackPayment } from "../../src/backend/services/payments/paystackRules";
import { settlePaystackCharge } from "../../src/backend/services/payments/paystackSettlement";
import type { PrismaClient } from "@prisma/client";

test("webhooks reject missing, wrong, malformed signatures and modified bodies", () => {
  const body = '{"event":"charge.success"}';
  const signature = createHmac("sha512", "test-only").update(body).digest("hex");
  assert.equal(validPaystackSignature(body, signature, "test-only"), true);
  for (const s of ["", "not-hex", "0".repeat(128), signature.slice(1)]) assert.equal(validPaystackSignature(body, s, "test-only"), false);
  assert.equal(validPaystackSignature(body + " ", signature, "test-only"), false);
  assert.equal(validPaystackSignature(body, signature, ""), false);
});

const charge = { reference: "PS-test", amount: 520, currency: "GHS", status: "success" };
test("verification requires exact successful amount, currency and reference", () => {
  const expected = { reference: "PS-test", amount: 5.2, currency: "GHS" };
  assert.equal(matchesPaystackPayment(expected, charge), true);
  for (const change of [{ amount: 1 }, { amount: 521 }, { currency: "NGN" }, { reference: "other" }, { status: "pending" }]) {
    assert.equal(matchesPaystackPayment(expected, { ...charge, ...change }), false);
  }
});

function fakeDb(kind: "wallet" | "order" | "agent_upgrade", options: { provider?: string; status?: string; failLedger?: boolean } = {}) {
  let state = {
    intent: { id: "intent", reference: charge.reference, userId: "customer", amount: 5.2, currency: "GHS",
      provider: options.provider ?? "PAYSTACK", status: options.status ?? "INITIATED",
      type: kind === "order" ? "ORDER" : "WALLET_TOPUP",
      metadata: { type: kind, networkId: "network", dataPlanId: "plan", recipientNumber: "0200000000" } },
    balance: 0, ledger: [] as unknown[], orders: [] as any[], upgrades: 0
  };
  let queue: Promise<unknown> = Promise.resolve();
  const db = { $transaction(fn: (tx: any) => Promise<unknown>) {
    const run = queue.then(async () => {
      const backup = structuredClone(state);
      const tx = {
        paymentIntent: {
          findUnique: async () => structuredClone(state.intent),
          updateMany: async () => { if (state.intent.status === "CONFIRMED") return { count: 0 }; state.intent.status = "CONFIRMED"; return { count: 1 }; }
        },
        apiConfiguration: { findFirst: async () => ({ id: "provider" }) },
        order: { findFirst: async () => state.orders[0] ?? null,
          create: async ({ data }: any) => { const o = { ...data, id: "order" }; state.orders.push(o); return o; } },
        user: { updateMany: async () => { state.upgrades++; return { count: 1 }; } },
        walletBalance: { findUnique: async () => ({ currentBalance: state.balance }),
          upsert: async ({ update }: any) => { state.balance += update.currentBalance.increment; return { currentBalance: state.balance }; } },
        walletTransaction: { create: async ({ data }: any) => { if (options.failLedger) throw new Error("ledger unavailable"); state.ledger.push(data); } }
      };
      try { return await fn(tx); } catch (e) { state = backup; throw e; }
    });
    queue = run.catch(() => {});
    return run;
  } } as unknown as PrismaClient;
  return { db, state: () => state, options };
}

for (const kind of ["wallet", "order", "agent_upgrade"] as const) {
  test(kind + ": concurrent callback/webhook plus replay applies value once", async () => {
    const store = fakeDb(kind);
    await Promise.all(Array.from({ length: 5 }, () => settlePaystackCharge(charge, store.db)));
    const s = store.state();
    assert.equal(s.intent.status, "CONFIRMED");
    assert.equal(s.balance, kind === "wallet" ? 5.2 : 0);
    assert.equal(s.orders.length, kind === "order" ? 1 : 0);
    assert.equal(s.upgrades, kind === "agent_upgrade" ? 1 : 0);
    assert.equal(s.ledger.length, kind === "agent_upgrade" ? 0 : 1);
  });
}
test("settlement refuses wrong amount/provider/cancelled intent with no credit", async () => {
  const a = fakeDb("wallet");
  await assert.rejects(() => settlePaystackCharge({ ...charge, amount: 1 }, a.db));
  assert.equal(a.state().balance, 0);
  const b = fakeDb("wallet", { provider: "MOOLRE" });
  assert.equal((await settlePaystackCharge(charge, b.db)).status, "not_found");
  assert.equal(b.state().balance, 0);
  const c = fakeDb("wallet", { status: "CANCELLED" });
  await assert.rejects(() => settlePaystackCharge(charge, c.db));
  assert.equal(c.state().balance, 0);
});
test("ledger failure rolls back confirmation and wallet; retry can complete", async () => {
  const store = fakeDb("wallet", { failLedger: true });
  await assert.rejects(() => settlePaystackCharge(charge, store.db));
  assert.equal(store.state().balance, 0);
  assert.equal(store.state().intent.status, "INITIATED");
  store.options.failLedger = false;
  await settlePaystackCharge(charge, store.db);
  assert.equal(store.state().balance, 5.2);
  assert.equal(store.state().ledger.length, 1);
});
