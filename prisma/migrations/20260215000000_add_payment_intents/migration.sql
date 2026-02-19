-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MOOLRE', 'PAYSTACK');

-- CreateEnum
CREATE TYPE "PaymentIntentType" AS ENUM ('WALLET_TOPUP', 'ORDER');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('INITIATED', 'PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "type" "PaymentIntentType" NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'INITIATED',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "reference" TEXT NOT NULL,
    "clientReference" TEXT,
    "metadata" JSONB,
    "rawInit" JSONB,
    "rawVerify" JSONB,
    "lastError" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_reference_key" ON "PaymentIntent"("reference");

-- CreateIndex
CREATE INDEX "PaymentIntent_clientReference_idx" ON "PaymentIntent"("clientReference");

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
