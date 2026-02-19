import test from "node:test";
import assert from "node:assert/strict";
import { buildSigningPayload, signRequest, verifyRequestSignature } from "../../src/backend/services/reseller/signing";

test("buildSigningPayload should preserve exact method/path/body order", () => {
  const payload = buildSigningPayload({
    method: "POST",
    pathWithQuery: "/api/v1/orders?foo=bar",
    rawBody: "{\"a\":1}",
    timestamp: "1771380000",
    nonce: "abc123"
  });

  assert.equal(
    payload,
    'POST\n/api/v1/orders?foo=bar\n{"a":1}\n1771380000\nabc123'
  );
});

test("verifyRequestSignature should accept valid signature and reject invalid", () => {
  const secret = "ghs_test_secret";
  const input = {
    method: "GET",
    pathWithQuery: "/api/v1/services?page=1&limit=20",
    rawBody: "",
    timestamp: "1771380000",
    nonce: "nonce123"
  };

  const valid = signRequest(secret, input);
  assert.equal(verifyRequestSignature(secret, input, valid), true);
  assert.equal(verifyRequestSignature(secret, input, `${valid}x`), false);
});
