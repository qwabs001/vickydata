import { Prisma } from "@prisma/client";
import { prisma } from "@/backend/lib/db/prisma";

const SCHEMA_ERROR_CODES = new Set(["P2010", "P2021", "P2022"]);

let notificationStorageReady = false;
let notificationStorageInitPromise: Promise<void> | null = null;

function errorMessage(value: unknown): string {
  if (!value) return "";
  if (value instanceof Error) return value.message.toLowerCase();
  return String(value).toLowerCase();
}

export function isNotificationStorageSchemaError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (SCHEMA_ERROR_CODES.has(error.code)) return true;
  }

  const message = errorMessage(error);
  if (!message.includes("notification")) return false;
  return (
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("relation") ||
    message.includes("enum")
  );
}

export async function ensureNotificationStorage(): Promise<void> {
  if (notificationStorageReady) return;

  if (!notificationStorageInitPromise) {
    notificationStorageInitPromise = (async () => {
      await prisma.$executeRawUnsafe(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    CREATE TYPE "NotificationType" AS ENUM ('POPUP', 'BELL');
  END IF;
END
$$;
`);

      await prisma.$executeRawUnsafe(`
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'POPUP';
`);
      await prisma.$executeRawUnsafe(`
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BELL';
`);

      await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
`);

      await prisma.$executeRawUnsafe(`
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
`);

      await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "NotificationRead" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("id")
);
`);

      await prisma.$executeRawUnsafe(`
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationRead_notificationId_userId_key"
ON "NotificationRead"("notificationId", "userId");
`);

      await prisma.$executeRawUnsafe(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'NotificationRead_notificationId_fkey'
  ) THEN
    ALTER TABLE "NotificationRead"
    ADD CONSTRAINT "NotificationRead_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;
`);
    })()
      .then(() => {
        notificationStorageReady = true;
      })
      .catch((error) => {
        notificationStorageInitPromise = null;
        throw error;
      });
  }

  await notificationStorageInitPromise;
}

export async function withNotificationStorageRecovery<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isNotificationStorageSchemaError(error)) {
      throw error;
    }
    await ensureNotificationStorage();
    return run();
  }
}
