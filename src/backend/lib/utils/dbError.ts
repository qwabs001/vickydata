import { Prisma } from "@prisma/client";

/**
 * Returns true if the error is likely a database connection/pool issue
 * (e.g. MaxClientsInSessionMode, connection refused, timeout).
 */
export function isDatabaseConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    lower.includes("maxclientsinsessionmode") ||
    lower.includes("connection") ||
    lower.includes("enotfound") ||
    lower.includes("econnrefused") ||
    lower.includes("econnreset") ||
    lower.includes("connection refused") ||
    lower.includes("tenant/user") ||
    lower.includes("could not translate host name") ||
    lower.includes("timeout") ||
    lower.includes("pool")
  );
}
