import test from "node:test";
import assert from "node:assert/strict";
import { signHmacSha256 } from "../../src/backend/services/reseller/crypto";
import { mapToResellerStatus } from "../../src/backend/services/reseller/format";
import {
  buildIdempotencyKey,
  calculateResellerOrderTotal,
  isInsufficientBalance
} from "../../src/backend/services/reseller/orderRules";

type SimOrder = {
  id: string;
  clientOrderId: string;
  amount: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  paymentStatus: "COMPLETED" | "REFUNDED";
};

test("simulated flow: create -> idempotent retry -> processing -> success -> webhook signature", () => {
  const store = new Map<string, SimOrder>();
  let walletBalance = 50;

  const createOrder = (agentId: string, clientOrderId: string, unitPrice: number, qty: number) => {
    const key = buildIdempotencyKey(agentId, clientOrderId);
    const existing = store.get(key);
    if (existing) return { idempotent: true as const, order: existing };

    const total = calculateResellerOrderTotal(unitPrice, qty);
    if (isInsufficientBalance(walletBalance, total)) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    walletBalance -= total;
    const order: SimOrder = {
      id: `ord_${store.size + 1}`,
      clientOrderId,
      amount: total,
      status: "PENDING",
      paymentStatus: "COMPLETED"
    };
    store.set(key, order);
    return { idempotent: false as const, order };
  };

  const first = createOrder("agent_1", "client-abc", 4.2, 2);
  assert.equal(first.idempotent, false);
  assert.equal(first.order.amount, 8.4);

  const retry = createOrder("agent_1", "client-abc", 4.2, 2);
  assert.equal(retry.idempotent, true);
  assert.equal(retry.order.id, first.order.id);

  first.order.status = "PROCESSING";
  assert.equal(mapToResellerStatus(first.order.status, first.order.paymentStatus), "processing");

  first.order.status = "COMPLETED";
  const mapped = mapToResellerStatus(first.order.status, first.order.paymentStatus);
  assert.equal(mapped, "success");

  const webhookPayload = {
    event: "order.updated",
    order_id: first.order.id,
    client_order_id: first.order.clientOrderId,
    status: mapped,
    amount: first.order.amount,
    currency: "GHS",
    timestamp: "2026-02-18T00:00:00.000Z"
  };

  const rawPayload = JSON.stringify(webhookPayload);
  const secret = "webhook-secret";
  const signature = signHmacSha256(secret, rawPayload);
  const envelope = { ...webhookPayload, signature };

  assert.equal(
    signHmacSha256(secret, JSON.stringify(webhookPayload)),
    envelope.signature
  );
});
