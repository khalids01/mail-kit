import { createHash, randomBytes } from "node:crypto";
import { resolveMx, resolveTxt } from "node:dns/promises";
import prisma from "@db/server";
import { sendEmail } from "@email/server";
import type { AdminMailQuery, ApiKeyCreate, DomainCreate, EmailQuery, EmailSend } from "./mail.dto";

const REQUIRED_DNS_PURPOSES = new Set(["mx", "spf", "dmarc"]);

export class MailPolicyError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
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

export class MailService {
  async getOverview(userId: string) {
    const [domains, verifiedDomains, apiKeys, sentEmails, failedEmails, recentEmails] =
      await Promise.all([
        prisma.domain.count({ where: { userId } }),
        prisma.domain.count({ where: { userId, status: "verified" } }),
        prisma.apiKey.count({ where: { userId, revokedAt: null } }),
        prisma.emailMessage.count({ where: { userId, status: "sent" } }),
        prisma.emailMessage.count({ where: { userId, status: "failed" } }),
        prisma.emailMessage.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { domain: { select: { name: true } } },
        }),
      ]);

    return { domains, verifiedDomains, apiKeys, sentEmails, failedEmails, recentEmails };
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
    const [totalDomains, verifiedDomains, suspendedDomains, sentEmails, failedEmails, apiKeys] =
      await Promise.all([
        prisma.domain.count(),
        prisma.domain.count({ where: { status: "verified" } }),
        prisma.domain.count({ where: { suspendedAt: { not: null } } }),
        prisma.emailMessage.count({ where: { status: "sent" } }),
        prisma.emailMessage.count({ where: { status: "failed" } }),
        prisma.apiKey.count({ where: { revokedAt: null } }),
      ]);

    return { totalDomains, verifiedDomains, suspendedDomains, sentEmails, failedEmails, apiKeys };
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
}

export const mailService = new MailService();
