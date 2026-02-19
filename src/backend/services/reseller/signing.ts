import { safeEqual, signHmacSha256 } from "@/backend/services/reseller/crypto";

export type SigningInput = {
  method: string;
  pathWithQuery: string;
  rawBody: string;
  timestamp: string;
  nonce: string;
};

export function buildSigningPayload(input: SigningInput): string {
  const body = input.rawBody.length > 0 ? input.rawBody : "";
  return [
    input.method.toUpperCase(),
    input.pathWithQuery,
    body,
    input.timestamp,
    input.nonce
  ].join("\n");
}

export function signRequest(secret: string, input: SigningInput): string {
  return signHmacSha256(secret, buildSigningPayload(input));
}

export function verifyRequestSignature(
  secret: string,
  input: SigningInput,
  signature: string
): boolean {
  const expected = signRequest(secret, input);
  return safeEqual(expected, signature.trim().toLowerCase());
}
