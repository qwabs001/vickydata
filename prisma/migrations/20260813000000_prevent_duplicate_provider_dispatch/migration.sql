ALTER TABLE "Order"
  ADD COLUMN "autoFulfillmentEligible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "providerDispatchStartedAt" TIMESTAMP(3);

-- Existing waiting orders must be dispatched manually after this safeguard is deployed.
UPDATE "Order"
SET "autoFulfillmentEligible" = false
WHERE "status" IN ('PENDING', 'PROCESSING', 'FAILED')
  AND "apiResponsePayload" IS NULL;

-- Treat historic provider responses as already dispatched, so a retry cannot duplicate them.
UPDATE "Order"
SET "providerDispatchStartedAt" = "updatedAt"
WHERE "providerDispatchStartedAt" IS NULL
  AND "apiResponsePayload" IS NOT NULL;
