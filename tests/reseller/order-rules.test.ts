import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_RESELLER_QTY,
  buildIdempotencyKey,
  calculateResellerOrderTotal,
  isInsufficientBalance,
  isValidResellerQty
} from "../../src/backend/services/reseller/orderRules";

test("qty validation should enforce reseller bounds", () => {
  assert.equal(isValidResellerQty(1), true);
  assert.equal(isValidResellerQty(MAX_RESELLER_QTY), true);
  assert.equal(isValidResellerQty(0), false);
  assert.equal(isValidResellerQty(MAX_RESELLER_QTY + 1), false);
  assert.equal(isValidResellerQty(1.5), false);
});

test("calculateResellerOrderTotal should round currency to 2dp", () => {
  assert.equal(calculateResellerOrderTotal(4.199, 3), 12.6);
  assert.equal(calculateResellerOrderTotal(0.1, 3), 0.3);
});

test("insufficient balance and idempotency key helpers", () => {
  assert.equal(isInsufficientBalance(10, 10), false);
  assert.equal(isInsufficientBalance(9.99, 10), true);
  assert.equal(buildIdempotencyKey("agent_1", "order_123"), "agent_1:order_123");
});
