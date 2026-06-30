CREATE TYPE "InboundEmailStatus" AS ENUM ('unread', 'read', 'archived', 'deleted');

CREATE TYPE "MailboxStatus" AS ENUM ('active', 'disabled', 'sync_failed');

CREATE TABLE "mailbox_address" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "domainId" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "localPart" TEXT NOT NULL,
  "displayName" TEXT,
  "status" "MailboxStatus" NOT NULL DEFAULT 'active',
  "mailuId" TEXT,
  "imapUsername" TEXT,
  "imapPassword" TEXT,
  "lastUid" INTEGER,
  "lastSyncAt" TIMESTAMP(3),
  "syncError" TEXT,
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mailbox_address_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inbound_email" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "domainId" TEXT,
  "mailboxId" TEXT,
  "messageId" TEXT,
  "imapUid" INTEGER,
  "fromAddress" TEXT NOT NULL,
  "toAddress" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "html" TEXT,
  "text" TEXT,
  "status" "InboundEmailStatus" NOT NULL DEFAULT 'unread',
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "rawHeaders" JSONB,
  "archivedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inbound_email_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mailbox_address_userId_address_key" ON "mailbox_address"("userId", "address");
CREATE INDEX "mailbox_address_domainId_address_idx" ON "mailbox_address"("domainId", "address");
CREATE INDEX "mailbox_address_status_updatedAt_idx" ON "mailbox_address"("status", "updatedAt");

CREATE UNIQUE INDEX "inbound_email_mailboxId_imapUid_key" ON "inbound_email"("mailboxId", "imapUid");
CREATE INDEX "inbound_email_userId_status_receivedAt_idx" ON "inbound_email"("userId", "status", "receivedAt");
CREATE INDEX "inbound_email_domainId_receivedAt_idx" ON "inbound_email"("domainId", "receivedAt");
CREATE INDEX "inbound_email_messageId_idx" ON "inbound_email"("messageId");

ALTER TABLE "mailbox_address"
  ADD CONSTRAINT "mailbox_address_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mailbox_address"
  ADD CONSTRAINT "mailbox_address_domainId_fkey"
  FOREIGN KEY ("domainId") REFERENCES "domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inbound_email"
  ADD CONSTRAINT "inbound_email_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inbound_email"
  ADD CONSTRAINT "inbound_email_domainId_fkey"
  FOREIGN KEY ("domainId") REFERENCES "domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inbound_email"
  ADD CONSTRAINT "inbound_email_mailboxId_fkey"
  FOREIGN KEY ("mailboxId") REFERENCES "mailbox_address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
