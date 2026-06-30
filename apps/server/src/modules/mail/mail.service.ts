import { createHash, randomBytes } from "node:crypto";
import { resolveMx, resolveTxt } from "node:dns/promises";
import prisma from "@db/server";
import { sendEmail } from "@email/server";
import { env } from "@env/server";
import { connectRedis } from "@redis/server";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type {
  AdminMailQuery,
  ApiKeyCreate,
  DomainCreate,
  EmailQuery,
  EmailSend,
  InboundEmailQuery,
  InboundEmailUpdate,
  InboundReply,
  MailboxCreate,
} from "./mail.dto";

const REQUIRED_DNS_PURPOSES = new Set(["mx", "spf", "dmarc"]);

export class MailPolicyError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

function normalizeDomainName(value: string) {
  const domain = value.trim().toLowerCase().replace(/\.$/, "");
  if (!/^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(domain)) {
    throw new MailPolicyError("Enter a valid domain name");
  }
  return domain;
}

function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}

function extractDomainFromEmail(value: string) {
  const email = extractEmailAddress(value);
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) {
    throw new MailPolicyError("From address must be a valid email address");
  }
  return normalizeDomainName(email.slice(at + 1));
}

function normalizeLocalPart(value: string) {
  const localPart = value.trim().toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/.test(localPart)) {
    throw new MailPolicyError("Enter a valid mailbox local part");
  }
  return localPart;
}

export function hashApiKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function generateApiKey() {
  const token = `mk_live_${randomBytes(24).toString("base64url")}`;
  return {
    token,
    prefix: token.slice(0, 16),
    hash: hashApiKey(token),
  };
}

export function buildDnsRecords(domain: string) {
  return [
    {
      type: "MX",
      name: "@",
      value: `mail.${domain}`,
      purpose: "mx",
    },
    {
      type: "TXT",
      name: "@",
      value: "v=spf1 mx ~all",
      purpose: "spf",
    },
    {
      type: "TXT",
      name: "_dmarc",
      value: "v=DMARC1; p=none",
      purpose: "dmarc",
    },
    {
      type: "TXT",
      name: "mail._domainkey",
      value: "v=DKIM1; k=rsa; p=DKIM_PUBLIC_KEY_HERE",
      purpose: "dkim",
    },
  ];
}

function flattenTxt(records: string[][]) {
  return records.map((record) => record.join(""));
}

async function verifyDns(domain: string) {
  const result = {
    mx: false,
    spf: false,
    dmarc: false,
  };

  try {
    result.mx = (await resolveMx(domain)).length > 0;
  } catch {
    result.mx = false;
  }

  try {
    result.spf = flattenTxt(await resolveTxt(domain)).some((record) =>
      record.toLowerCase().startsWith("v=spf1"),
    );
  } catch {
    result.spf = false;
  }

  try {
    result.dmarc = flattenTxt(await resolveTxt(`_dmarc.${domain}`)).some((record) =>
      record.toLowerCase().startsWith("v=dmarc1"),
    );
  } catch {
    result.dmarc = false;
  }

  return result;
}

function pageArgs(query: { page?: number; limit?: number }) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function formatAddressList(value: unknown) {
  if (!value || typeof value !== "object" || !("value" in value)) {
    return "";
  }
  const addresses = (value as { value?: Array<{ address?: string; name?: string }> }).value ?? [];
  return addresses
    .map((address) => {
      if (address.name && address.address) return `${address.name} <${address.address}>`;
      return address.address ?? "";
    })
    .filter(Boolean)
    .join(", ");
}

async function enforceSendRateLimit(apiKeyId: string) {
  const redis = await connectRedis();
  const bucket = Math.floor(Date.now() / 60_000);
  const key = `mail:send:${apiKeyId}:${bucket}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 70);
  }

  if (count > env.MAIL_ENGINE_SEND_RATE_LIMIT_PER_MINUTE) {
    const ttl = await redis.ttl(key);
    throw new MailPolicyError("Send rate limit exceeded", 429, {
      retryAfterSeconds: ttl > 0 ? ttl : 60,
      limit: env.MAIL_ENGINE_SEND_RATE_LIMIT_PER_MINUTE,
    });
  }
}

export class MailService {
  async getOverview(userId: string) {
    const [domains, verifiedDomains, apiKeys, sentEmails, failedEmails, unreadInbound, recentEmails] =
      await Promise.all([
        prisma.domain.count({ where: { userId } }),
        prisma.domain.count({ where: { userId, status: "verified" } }),
        prisma.apiKey.count({ where: { userId, revokedAt: null } }),
        prisma.emailMessage.count({ where: { userId, status: "sent" } }),
        prisma.emailMessage.count({ where: { userId, status: "failed" } }),
        prisma.inboundEmail.count({ where: { userId, status: "unread" } }),
        prisma.emailMessage.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { domain: { select: { name: true } } },
        }),
      ]);

    return { domains, verifiedDomains, apiKeys, sentEmails, failedEmails, unreadInbound, recentEmails };
  }

  async listDomains(userId: string) {
    return prisma.domain.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { dnsRecords: { orderBy: { createdAt: "asc" } } },
    });
  }

  async createDomain(userId: string, input: DomainCreate) {
    const name = normalizeDomainName(input.name);
    const records = buildDnsRecords(name);

    try {
      return await prisma.domain.create({
        data: {
          userId,
          name,
          dnsRecords: {
            create: records,
          },
        },
        include: { dnsRecords: { orderBy: { createdAt: "asc" } } },
      });
    } catch {
      throw new MailPolicyError("Domain already exists for your account");
    }
  }

  async getDomain(userId: string, id: string) {
    return prisma.domain.findFirst({
      where: { id, userId },
      include: { dnsRecords: { orderBy: { createdAt: "asc" } } },
    });
  }

  async deleteDomain(userId: string, id: string) {
    await prisma.domain.delete({ where: { id, userId } });
    return { ok: true };
  }

  async verifyDomainForUser(userId: string, id: string) {
    const domain = await prisma.domain.findFirst({
      where: { id, userId },
      include: { dnsRecords: true },
    });
    if (!domain) {
      throw new MailPolicyError("Domain not found", 404);
    }
    return this.verifyDomain(domain.id, domain.name);
  }

  async verifyDomain(id: string, name: string) {
    const dns = await verifyDns(name);
    const now = new Date();

    await Promise.all(
      Object.entries(dns).map(([purpose, ok]) =>
        prisma.dnsRecord.updateMany({
          where: { domainId: id, purpose },
          data: {
            status: ok ? "verified" : "failed",
            lastCheckedAt: now,
          },
        }),
      ),
    );

    await prisma.dnsRecord.updateMany({
      where: { domainId: id, purpose: "dkim" },
      data: { status: "pending", lastCheckedAt: now },
    });

    const requiredVerified = Object.entries(dns)
      .filter(([purpose]) => REQUIRED_DNS_PURPOSES.has(purpose))
      .every(([, ok]) => ok);

    return prisma.domain.update({
      where: { id },
      data: {
        status: requiredVerified ? "verified" : "failed",
        verificationStatus: requiredVerified ? "verified" : "failed",
        sendingEnabled: requiredVerified,
        suspendedAt: requiredVerified ? null : undefined,
      },
      include: { dnsRecords: { orderBy: { createdAt: "asc" } } },
    });
  }

  async listApiKeys(userId: string) {
    return prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async createApiKey(userId: string, input: ApiKeyCreate) {
    const key = generateApiKey();
    const created = await prisma.apiKey.create({
      data: {
        userId,
        name: input.name.trim(),
        prefix: key.prefix,
        hash: key.hash,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    });

    return {
      ...created,
      token: key.token,
    };
  }

  async revokeApiKey(userId: string, id: string) {
    return prisma.apiKey.update({
      where: { id, userId },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async listMailboxes(userId: string) {
    return prisma.mailboxAddress.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { domain: { select: { name: true, status: true } } },
    });
  }

  async createMailbox(userId: string, input: MailboxCreate) {
    const domain = await prisma.domain.findFirst({
      where: { id: input.domainId, userId },
    });
    if (!domain) {
      throw new MailPolicyError("Domain not found", 404);
    }

    const localPart = normalizeLocalPart(input.localPart);
    const address = `${localPart}@${domain.name}`;

    try {
      return await prisma.mailboxAddress.create({
        data: {
          userId,
          domainId: domain.id,
          address,
          localPart,
          displayName: input.displayName?.trim() || null,
          imapUsername: input.imapUsername?.trim() || address,
          imapPassword: input.imapPassword || null,
        },
        include: { domain: { select: { name: true, status: true } } },
      });
    } catch {
      throw new MailPolicyError("Mailbox address already exists for your account");
    }
  }

  async syncMailboxForUser(userId: string, id: string) {
    const mailbox = await prisma.mailboxAddress.findFirst({
      where: { id, userId },
      include: { domain: true },
    });
    if (!mailbox) {
      throw new MailPolicyError("Mailbox not found", 404);
    }
    return this.syncMailbox(mailbox.id);
  }

  async syncMailbox(id: string) {
    const mailbox = await prisma.mailboxAddress.findUnique({
      where: { id },
      include: { domain: true },
    });
    if (!mailbox) {
      throw new MailPolicyError("Mailbox not found", 404);
    }
    if (mailbox.disabledAt || mailbox.status === "disabled") {
      throw new MailPolicyError("Mailbox is disabled", 403);
    }
    if (!env.MAIL_ENGINE_IMAP_HOST) {
      throw new MailPolicyError("MAIL_ENGINE_IMAP_HOST is not configured", 400);
    }
    if (!mailbox.imapUsername || !mailbox.imapPassword) {
      throw new MailPolicyError("Mailbox IMAP credentials are missing", 400);
    }

    const client = new ImapFlow({
      host: env.MAIL_ENGINE_IMAP_HOST,
      port: env.MAIL_ENGINE_IMAP_PORT ? Number(env.MAIL_ENGINE_IMAP_PORT) : 993,
      secure: env.MAIL_ENGINE_IMAP_SECURE,
      auth: {
        user: mailbox.imapUsername,
        pass: mailbox.imapPassword,
      },
      logger: false,
    });

    let imported = 0;
    let lastUid = mailbox.lastUid ?? 0;

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const range = lastUid > 0 ? `${lastUid + 1}:*` : "1:*";
        for await (const message of client.fetch(range, {
          uid: true,
          source: true,
          envelope: true,
          flags: true,
        })) {
          if (!message.uid || message.uid <= lastUid || !message.source) continue;
          const parsed = await simpleParser(message.source);
          const messageId = parsed.messageId || message.envelope?.messageId || null;
          const fromAddress = formatAddressList(parsed.from) || "unknown";
          const toAddress = formatAddressList(parsed.to) || mailbox.address;
          const subject = parsed.subject || "(no subject)";
          const receivedAt = parsed.date ?? message.envelope?.date ?? new Date();
          const isSeen = Array.from(message.flags ?? []).some((flag) => flag.toLowerCase() === "\\seen");

          await prisma.inboundEmail.upsert({
            where: {
              mailboxId_imapUid: {
                mailboxId: mailbox.id,
                imapUid: message.uid,
              },
            },
            create: {
              userId: mailbox.userId,
              domainId: mailbox.domainId,
              mailboxId: mailbox.id,
              imapUid: message.uid,
              messageId,
              fromAddress,
              toAddress,
              subject,
              html: parsed.html || null,
              text: parsed.text || null,
              status: isSeen ? "read" : "unread",
              receivedAt,
              readAt: isSeen ? new Date() : null,
              rawHeaders: parsed.headerLines?.map((header) => ({
                key: header.key,
                line: header.line,
              })),
            },
            update: {},
          });

          imported += 1;
          lastUid = Math.max(lastUid, message.uid);
        }
      } finally {
        lock.release();
      }
      await client.logout();

      const updated = await prisma.mailboxAddress.update({
        where: { id: mailbox.id },
        data: {
          lastUid,
          lastSyncAt: new Date(),
          syncError: null,
          status: "active",
        },
        include: { domain: { select: { name: true, status: true } } },
      });

      return { mailbox: updated, imported };
    } catch (error) {
      await client.logout().catch(() => undefined);
      const message = error instanceof Error ? error.message : "IMAP sync failed";
      await prisma.mailboxAddress.update({
        where: { id: mailbox.id },
        data: {
          lastSyncAt: new Date(),
          syncError: message,
          status: "sync_failed",
        },
      });
      throw new MailPolicyError(message, 502);
    }
  }

  async listInboundEmails(userId: string, query: InboundEmailQuery) {
    const { page, limit, skip } = pageArgs(query);
    const where = {
      userId,
      ...(query.status ? { status: query.status } : { status: { not: "deleted" as const } }),
      ...(query.mailboxId ? { mailboxId: query.mailboxId } : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: "insensitive" as const } },
              { fromAddress: { contains: query.search, mode: "insensitive" as const } },
              { toAddress: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.inboundEmail.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        skip,
        take: limit,
        include: {
          domain: { select: { name: true } },
          mailbox: { select: { address: true } },
        },
      }),
      prisma.inboundEmail.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  async getInboundEmail(userId: string, id: string) {
    return prisma.inboundEmail.findFirst({
      where: { id, userId },
      include: {
        domain: { select: { name: true } },
        mailbox: { select: { address: true } },
      },
    });
  }

  async updateInboundEmail(userId: string, id: string, input: InboundEmailUpdate) {
    const now = new Date();
    return prisma.inboundEmail.update({
      where: { id, userId },
      data: {
        status: input.status,
        readAt: input.status === "read" ? now : input.status === "unread" ? null : undefined,
        archivedAt: input.status === "archived" ? now : undefined,
        deletedAt: input.status === "deleted" ? now : undefined,
      },
    });
  }

  async replyToInboundEmail(userId: string, id: string, input: InboundReply) {
    if (!input.html && !input.text) {
      throw new MailPolicyError("Either html or text is required");
    }

    const inbound = await prisma.inboundEmail.findFirst({
      where: { id, userId },
      include: { domain: true },
    });
    if (!inbound) {
      throw new MailPolicyError("Inbound email not found", 404);
    }

    const fromDomain = extractDomainFromEmail(input.from);
    if (!inbound.domain || inbound.domain.name !== fromDomain) {
      throw new MailPolicyError("Reply sender must belong to the inbound domain", 403);
    }
    if (inbound.domain.status !== "verified" || !inbound.domain.sendingEnabled || inbound.domain.suspendedAt) {
      throw new MailPolicyError("Reply domain is not enabled for sending", 403);
    }

    const outbound = await prisma.emailMessage.create({
      data: {
        userId,
        domainId: inbound.domainId,
        fromAddress: input.from,
        toAddress: inbound.fromAddress,
        subject: inbound.subject.startsWith("Re:") ? inbound.subject : `Re: ${inbound.subject}`,
        html: input.html,
        text: input.text,
        status: "queued",
        events: {
          create: {
            type: "queued",
            message: "Reply accepted for delivery",
            metadata: { inboundEmailId: inbound.id },
          },
        },
      },
    });

    try {
      const info = await sendEmail({
        from: input.from,
        to: inbound.fromAddress,
        subject: outbound.subject,
        html: input.html,
        text: input.text,
      });
      const updated = await prisma.emailMessage.update({
        where: { id: outbound.id },
        data: {
          status: "sent",
          providerMessageId: info.messageId,
          events: {
            create: {
              type: "sent",
              message: "Reply sent through SMTP transport",
              metadata: { messageId: info.messageId, inboundEmailId: inbound.id },
            },
          },
        },
      });
      return { id: updated.id, status: updated.status, messageId: updated.providerMessageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMTP reply failed";
      await prisma.emailMessage.update({
        where: { id: outbound.id },
        data: {
          status: "failed",
          errorMessage: message,
          events: { create: { type: "failed", message } },
        },
      });
      throw new MailPolicyError(message, 502);
    }
  }

  async listEmails(userId: string, query: EmailQuery) {
    const { page, limit, skip } = pageArgs(query);
    const where = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.domainId ? { domainId: query.domainId } : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: "insensitive" as const } },
              { toAddress: { contains: query.search, mode: "insensitive" as const } },
              { fromAddress: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.emailMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { domain: { select: { name: true } } },
      }),
      prisma.emailMessage.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  async getEmail(userId: string, id: string) {
    return prisma.emailMessage.findFirst({
      where: { id, userId },
      include: {
        domain: { select: { name: true } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  async sendWithApiKey(token: string | undefined, input: EmailSend) {
    if (!token?.startsWith("mk_")) {
      throw new MailPolicyError("Invalid API key", 401);
    }
    if (!input.html && !input.text) {
      throw new MailPolicyError("Either html or text is required");
    }

    const apiKey = await prisma.apiKey.findUnique({
      where: { hash: hashApiKey(token) },
    });
    if (!apiKey || apiKey.revokedAt) {
      throw new MailPolicyError("Invalid API key", 401);
    }
    await enforceSendRateLimit(apiKey.id);

    const fromDomain = extractDomainFromEmail(input.from);
    const domain = await prisma.domain.findFirst({
      where: {
        userId: apiKey.userId,
        name: fromDomain,
      },
    });

    if (!domain) {
      throw new MailPolicyError("Sender domain is not registered", 403);
    }
    if (domain.status !== "verified" || !domain.sendingEnabled) {
      throw new MailPolicyError("Sender domain is not verified for sending", 403);
    }
    if (domain.suspendedAt) {
      throw new MailPolicyError("Sender domain is suspended", 403);
    }

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    const email = await prisma.emailMessage.create({
      data: {
        userId: apiKey.userId,
        domainId: domain.id,
        fromAddress: input.from,
        toAddress: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        status: "queued",
        events: {
          create: {
            type: "queued",
            message: "Message accepted for delivery",
          },
        },
      },
    });

    try {
      const info = await sendEmail(input);
      const updated = await prisma.emailMessage.update({
        where: { id: email.id },
        data: {
          status: "sent",
          providerMessageId: info.messageId,
          events: {
            create: {
              type: "sent",
              message: "Message sent through SMTP transport",
              metadata: { messageId: info.messageId },
            },
          },
        },
      });
      return { id: updated.id, status: updated.status, messageId: updated.providerMessageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMTP send failed";
      await prisma.emailMessage.update({
        where: { id: email.id },
        data: {
          status: "failed",
          errorMessage: message,
          events: {
            create: {
              type: "failed",
              message,
            },
          },
        },
      });
      throw new MailPolicyError(message, 502);
    }
  }

  async getAdminOverview() {
    const [
      totalDomains,
      verifiedDomains,
      suspendedDomains,
      sentEmails,
      failedEmails,
      apiKeys,
      mailboxes,
      unreadInbound,
      syncFailedMailboxes,
    ] =
      await Promise.all([
        prisma.domain.count(),
        prisma.domain.count({ where: { status: "verified" } }),
        prisma.domain.count({ where: { suspendedAt: { not: null } } }),
        prisma.emailMessage.count({ where: { status: "sent" } }),
        prisma.emailMessage.count({ where: { status: "failed" } }),
        prisma.apiKey.count({ where: { revokedAt: null } }),
        prisma.mailboxAddress.count(),
        prisma.inboundEmail.count({ where: { status: "unread" } }),
        prisma.mailboxAddress.count({ where: { status: "sync_failed" } }),
      ]);

    return {
      totalDomains,
      verifiedDomains,
      suspendedDomains,
      sentEmails,
      failedEmails,
      apiKeys,
      mailboxes,
      unreadInbound,
      syncFailedMailboxes,
    };
  }

  async listAdminDomains(query: AdminMailQuery) {
    const { page, limit, skip } = pageArgs(query);
    const where = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { user: { email: { contains: query.search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.domain.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { email: true, name: true } },
          dnsRecords: { orderBy: { createdAt: "asc" } },
        },
      }),
      prisma.domain.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  async listAdminEmails(query: AdminMailQuery) {
    const { page, limit, skip } = pageArgs(query);
    const where = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: "insensitive" as const } },
              { toAddress: { contains: query.search, mode: "insensitive" as const } },
              { fromAddress: { contains: query.search, mode: "insensitive" as const } },
              { user: { email: { contains: query.search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.emailMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { email: true, name: true } },
          domain: { select: { name: true } },
        },
      }),
      prisma.emailMessage.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  async listAdminApiKeys(query: AdminMailQuery) {
    const { page, limit, skip } = pageArgs(query);
    const where = {
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { prefix: { contains: query.search, mode: "insensitive" as const } },
              { user: { email: { contains: query.search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.apiKey.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          prefix: true,
          lastUsedAt: true,
          revokedAt: true,
          createdAt: true,
          user: { select: { email: true, name: true } },
        },
      }),
      prisma.apiKey.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  async listAdminMailboxes(query: AdminMailQuery) {
    const { page, limit, skip } = pageArgs(query);
    const where = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { address: { contains: query.search, mode: "insensitive" as const } },
              { user: { email: { contains: query.search, mode: "insensitive" as const } } },
              { domain: { name: { contains: query.search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.mailboxAddress.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { email: true, name: true } },
          domain: { select: { name: true, status: true } },
          _count: { select: { inboundEmails: true } },
        },
      }),
      prisma.mailboxAddress.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  async suspendDomain(id: string) {
    return prisma.domain.update({
      where: { id },
      data: {
        status: "suspended",
        sendingEnabled: false,
        suspendedAt: new Date(),
      },
    });
  }

  async unsuspendDomain(id: string) {
    const domain = await prisma.domain.findUnique({ where: { id } });
    if (!domain) {
      throw new MailPolicyError("Domain not found", 404);
    }
    return prisma.domain.update({
      where: { id },
      data: {
        status: domain.verificationStatus,
        sendingEnabled: domain.verificationStatus === "verified",
        suspendedAt: null,
      },
    });
  }

  async verifyDomainForAdmin(id: string) {
    const domain = await prisma.domain.findUnique({ where: { id } });
    if (!domain) {
      throw new MailPolicyError("Domain not found", 404);
    }
    return this.verifyDomain(domain.id, domain.name);
  }

  async disableMailbox(id: string) {
    return prisma.mailboxAddress.update({
      where: { id },
      data: {
        status: "disabled",
        disabledAt: new Date(),
      },
      include: { domain: { select: { name: true, status: true } } },
    });
  }

  async enableMailbox(id: string) {
    return prisma.mailboxAddress.update({
      where: { id },
      data: {
        status: "active",
        disabledAt: null,
        syncError: null,
      },
      include: { domain: { select: { name: true, status: true } } },
    });
  }
}

export const mailService = new MailService();

let inboundSyncTimer: Timer | null = null;

export function startInboundSyncWorker() {
  if (!env.MAIL_ENGINE_SYNC_ENABLED || inboundSyncTimer) {
    return;
  }

  const run = async () => {
    const mailboxes = await prisma.mailboxAddress.findMany({
      where: {
        status: { in: ["active", "sync_failed"] },
        disabledAt: null,
        imapUsername: { not: null },
        imapPassword: { not: null },
      },
      select: { id: true },
      take: 50,
      orderBy: [{ lastSyncAt: "asc" }, { createdAt: "asc" }],
    });

    for (const mailbox of mailboxes) {
      try {
        await mailService.syncMailbox(mailbox.id);
      } catch (error) {
        console.error("Inbound sync failed", mailbox.id, error);
      }
    }
  };

  void run();
  inboundSyncTimer = setInterval(
    () => void run(),
    env.MAIL_ENGINE_SYNC_INTERVAL_SECONDS * 1000,
  );
}
