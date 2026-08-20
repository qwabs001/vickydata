-- CreateEnum
CREATE TYPE "AgentApiCredentialStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ResellerWebhookDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "AgentApiCredential" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT,
    "apiKey" TEXT NOT NULL,
    "apiSecretHash" TEXT NOT NULL,
    "apiSecretEnc" TEXT NOT NULL,
    "status" "AgentApiCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "ipAllowlist" JSONB,
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 60,
    "lastUsedAt" TIMESTAMP(3),
    "lastRequestAt" TIMESTAMP(3),
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentApiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentApiNonce" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentApiNonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentApiRequestLog" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "credentialId" TEXT,
    "requestId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "ipAddress" TEXT,
    "errorCode" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentExternalOrder" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "credentialId" TEXT,
    "orderId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "clientOrderId" TEXT NOT NULL,
    "providerRef" TEXT,
    "lastKnownStatus" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentExternalOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentWebhookSubscription" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "events" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentWebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentWebhookDelivery" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "externalOrderId" TEXT,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ResellerWebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentApiCredential_apiKey_key" ON "AgentApiCredential"("apiKey");

-- CreateIndex
CREATE INDEX "AgentApiCredential_agentId_status_idx" ON "AgentApiCredential"("agentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentApiNonce_credentialId_nonce_key" ON "AgentApiNonce"("credentialId", "nonce");

-- CreateIndex
CREATE INDEX "AgentApiNonce_credentialId_createdAt_idx" ON "AgentApiNonce"("credentialId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentApiNonce_agentId_createdAt_idx" ON "AgentApiNonce"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentApiRequestLog_agentId_createdAt_idx" ON "AgentApiRequestLog"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentApiRequestLog_credentialId_createdAt_idx" ON "AgentApiRequestLog"("credentialId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentApiRequestLog_createdAt_idx" ON "AgentApiRequestLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentExternalOrder_orderId_key" ON "AgentExternalOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentExternalOrder_agentId_clientOrderId_key" ON "AgentExternalOrder"("agentId", "clientOrderId");

-- CreateIndex
CREATE INDEX "AgentExternalOrder_agentId_createdAt_idx" ON "AgentExternalOrder"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentExternalOrder_credentialId_createdAt_idx" ON "AgentExternalOrder"("credentialId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentWebhookSubscription_agentId_enabled_idx" ON "AgentWebhookSubscription"("agentId", "enabled");

-- CreateIndex
CREATE INDEX "AgentWebhookDelivery_agentId_createdAt_idx" ON "AgentWebhookDelivery"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentWebhookDelivery_status_nextAttemptAt_idx" ON "AgentWebhookDelivery"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "AgentApiCredential" ADD CONSTRAINT "AgentApiCredential_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentApiNonce" ADD CONSTRAINT "AgentApiNonce_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentApiNonce" ADD CONSTRAINT "AgentApiNonce_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AgentApiCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentApiRequestLog" ADD CONSTRAINT "AgentApiRequestLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentApiRequestLog" ADD CONSTRAINT "AgentApiRequestLog_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AgentApiCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExternalOrder" ADD CONSTRAINT "AgentExternalOrder_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExternalOrder" ADD CONSTRAINT "AgentExternalOrder_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AgentApiCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExternalOrder" ADD CONSTRAINT "AgentExternalOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWebhookSubscription" ADD CONSTRAINT "AgentWebhookSubscription_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWebhookDelivery" ADD CONSTRAINT "AgentWebhookDelivery_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWebhookDelivery" ADD CONSTRAINT "AgentWebhookDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AgentWebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWebhookDelivery" ADD CONSTRAINT "AgentWebhookDelivery_externalOrderId_fkey" FOREIGN KEY ("externalOrderId") REFERENCES "AgentExternalOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
