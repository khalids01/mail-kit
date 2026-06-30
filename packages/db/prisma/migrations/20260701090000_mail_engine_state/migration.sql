CREATE TYPE "MailEngineStatus" AS ENUM ('manual', 'pending', 'provisioned', 'failed');

ALTER TABLE "domain"
  ADD COLUMN "engineStatus" "MailEngineStatus" NOT NULL DEFAULT 'manual',
  ADD COLUMN "engineId" TEXT,
  ADD COLUMN "engineLastSyncAt" TIMESTAMP(3),
  ADD COLUMN "engineError" TEXT;

ALTER TABLE "mailbox_address"
  ADD COLUMN "engineStatus" "MailEngineStatus" NOT NULL DEFAULT 'manual',
  ADD COLUMN "engineLastSyncAt" TIMESTAMP(3),
  ADD COLUMN "engineError" TEXT;

CREATE INDEX "domain_engineStatus_updatedAt_idx" ON "domain"("engineStatus", "updatedAt");
CREATE INDEX "mailbox_address_engineStatus_updatedAt_idx" ON "mailbox_address"("engineStatus", "updatedAt");
