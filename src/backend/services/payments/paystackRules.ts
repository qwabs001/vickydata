import { createHmac, timingSafeEqual } from "node:crypto";

export function validPaystackSignature(body: string, signature: string, secret: string): boolean {
  if (!secret || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export function matchesPaystackPayment(
  expected: { reference: string; amount: number; currency: string },
  actual: { reference?: string; amount?: number; currency?: string; status?: string }
): boolean {
  return actual.status === "success" && actual.reference === expected.reference &&
    Number.isSafeInteger(actual.amount) && actual.amount === Math.round(expected.amount * 100) &&
    actual.currency === expected.currency;
}
