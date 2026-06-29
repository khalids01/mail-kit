CREATE TYPE "DomainStatus" AS ENUM ('pending', 'verified', 'failed', 'suspended');
CREATE TYPE "DnsRecordStatus" AS ENUM ('pending', 'verified', 'failed');
CREATE TYPE "EmailStatus" AS ENUM ('queued', 'sent', 'failed');

CREATE TABLE "domain" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "DomainStatus" NOT NULL DEFAULT 'pending',
  "verificationStatus" "DomainStatus" NOT NULL DEFAULT 'pending',
  "sendingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "suspendedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "domain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dns_record" (
  "id" TEXT NOT NULL,
  "domainId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" "DnsRecordStatus" NOT NULL DEFAULT 'pending',
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dns_record_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "api_key" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_message" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "domainId" TEXT,
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "html" TEXT,
  "text" TEXT,
  "status" "EmailStatus" NOT NULL DEFAULT 'queued',
  "providerMessageId" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_log" (
  "id" TEXT NOT NULL,
  "emailMessageId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "domain_userId_name_key" ON "domain"("userId", "name");
CREATE INDEX "domain_status_createdAt_idx" ON "domain"("status", "createdAt");
CREATE INDEX "domain_userId_createdAt_idx" ON "domain"("userId", "createdAt");

CREATE INDEX "dns_record_domainId_idx" ON "dns_record"("domainId");
CREATE INDEX "dns_record_status_idx" ON "dns_record"("status");

CREATE UNIQUE INDEX "api_key_hash_key" ON "api_key"("hash");
CREATE INDEX "api_key_userId_createdAt_idx" ON "api_key"("userId", "createdAt");
CREATE INDEX "api_key_prefix_idx" ON "api_key"("prefix");
CREATE INDEX "api_key_revokedAt_idx" ON "api_key"("revokedAt");

CREATE INDEX "email_message_userId_createdAt_idx" ON "email_message"("userId", "createdAt");
CREATE INDEX "email_message_domainId_createdAt_idx" ON "email_message"("domainId", "createdAt");
CREATE INDEX "email_message_status_createdAt_idx" ON "email_message"("status", "createdAt");

CREATE INDEX "email_log_emailMessageId_createdAt_idx" ON "email_log"("emailMessageId", "createdAt");
CREATE INDEX "email_log_type_createdAt_idx" ON "email_log"("type", "createdAt");

ALTER TABLE "domain" ADD CONSTRAINT "domain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dns_record" ADD CONSTRAINT "dns_record_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "email_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
