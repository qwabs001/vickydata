import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

const DEFAULT_SECRET_NAMESPACE = "bundlearena-reseller-api";

function getBaseSecret(): string {
  return (
    process.env.RESELLER_API_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    process.env.MOOLRE_SECRET_KEY ||
    DEFAULT_SECRET_NAMESPACE
  );
}

function getAesKey(): Buffer {
  return createHash("sha256").update(`enc:${getBaseSecret()}`).digest();
}

function getHashSalt(): string {
  return `hash:${getBaseSecret()}`;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(`${getHashSalt()}:${secret}`).digest("hex");
}

export function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getAesKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, encryptedHex] = payload.split(":");
  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error("Invalid encrypted secret payload.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getAesKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

export function generateApiKey(): string {
  return `gha_${randomBytes(16).toString("hex")}`;
}

export function generateApiSecret(): string {
  return `ghs_${randomBytes(32).toString("hex")}`;
}

export function generateRequestId(): string {
  return `req_${randomBytes(12).toString("hex")}`;
}

export function signHmacSha256(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
