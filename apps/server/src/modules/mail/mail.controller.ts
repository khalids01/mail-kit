import { Elysia } from "elysia";
import { Permissions } from "@rbac";
import { authGuard } from "@/guards/auth.guard";
import { requirePermission } from "@/rbac/guards/permissions.guard";
import { mailService, MailPolicyError } from "./mail.service";
import {
  ApiKeyCreateDto,
  DomainCreateDto,
  EmailQueryDto,
  EmailSendDto,
  InboundEmailQueryDto,
  InboundEmailUpdateDto,
  InboundReplyDto,
  MailboxCreateDto,
} from "./mail.dto";

function handleMailError(error: unknown, set: { status?: number | string; headers?: Record<string, unknown> }) {
  if (error instanceof MailPolicyError) {
    set.status = error.status;
    if (error.details?.retryAfterSeconds && set.headers) {
      set.headers["Retry-After"] = String(error.details.retryAfterSeconds);
      set.headers["X-RateLimit-Limit"] = String(error.details.limit ?? "");
      set.headers["X-RateLimit-Remaining"] = "0";
    }
    return { message: error.message, status: error.status };
  }

  set.status = 400;
  return {
    message: error instanceof Error ? error.message : "Mail operation failed",
    status: 400,
  };
}

function bearerToken(header: string | undefined) {
  const [scheme, token] = header?.split(" ") ?? [];
  return scheme?.toLowerCase() === "bearer" ? token : undefined;
}

export const mailController = new Elysia({
  detail: { tags: ["Mail"] },
})
  .post(
    "/emails/send",
    async ({ headers, body, set }) => {
      try {
        return await mailService.sendWithApiKey(
          bearerToken(headers.authorization),
          body,
        );
      } catch (error) {
        return handleMailError(error, set);
      }
    },
    {
      body: EmailSendDto,
      detail: { summary: "Send an email with a Mail Kit API key" },
    },
  )
  .get(
    "/inbound/emails",
    async ({ headers, query, set }) => {
      try {
        return await mailService.listInboundEmailsWithApiKey(
          bearerToken(headers.authorization),
          query,
        );
      } catch (error) {
        return handleMailError(error, set);
      }
    },
    {
      query: InboundEmailQueryDto,
      detail: { summary: "List inbound emails with a Mail Kit API key" },
    },
  )
  .get(
    "/inbound/emails/:id",
    async ({ headers, params: { id }, set }) => {
      try {
        return await mailService.getInboundEmailWithApiKey(
          bearerToken(headers.authorization),
          id,
        );
      } catch (error) {
        return handleMailError(error, set);
      }
    },
    {
      detail: { summary: "Get an inbound email with a Mail Kit API key" },
    },
  )
  .post(
    "/inbound/emails/:id/status",
    async ({ headers, params: { id }, body, set }) => {
      try {
        return await mailService.updateInboundEmailWithApiKey(
          bearerToken(headers.authorization),
          id,
          body,
        );
      } catch (error) {
        return handleMailError(error, set);
      }
    },
    {
      body: InboundEmailUpdateDto,
      detail: { summary: "Update inbound email status with a Mail Kit API key" },
    },
  )
  .post(
    "/inbound/emails/:id/reply",
    async ({ headers, params: { id }, body, set }) => {
      try {
        return await mailService.replyToInboundEmailWithApiKey(
          bearerToken(headers.authorization),
          id,
          body,
        );
      } catch (error) {
        return handleMailError(error, set);
      }
    },
    {
      body: InboundReplyDto,
      detail: { summary: "Reply to an inbound email with a Mail Kit API key" },
    },
  )
  .use(authGuard)
  .get("/mail/overview", ({ userId, set }) => {
    if (!userId) {
      set.status = 401;
      return { message: "Unauthorized" };
    }
    return mailService.getOverview(userId);
  })
  .guard(
    { beforeHandle: requirePermission(Permissions.MailDomainsManage) },
    (app) =>
      app
        .get("/domains", ({ userId }) => mailService.listDomains(userId!))
        .post(
          "/domains",
          async ({ userId, body, set }) => {
            try {
              return await mailService.createDomain(userId!, body);
            } catch (error) {
              return handleMailError(error, set);
            }
          },
          { body: DomainCreateDto },
        )
        .get("/domains/:id", async ({ userId, params: { id }, set }) => {
          const domain = await mailService.getDomain(userId!, id);
          if (!domain) {
            set.status = 404;
            return { message: "Domain not found" };
          }
          return domain;
        })
        .post("/domains/:id/verify", async ({ userId, params: { id }, set }) => {
          try {
            return await mailService.verifyDomainForUser(userId!, id);
          } catch (error) {
            return handleMailError(error, set);
          }
        })
        .delete("/domains/:id", async ({ userId, params: { id }, set }) => {
          try {
            return await mailService.deleteDomain(userId!, id);
          } catch (error) {
            return handleMailError(error, set);
          }
        }),
  )
  .guard(
    { beforeHandle: requirePermission(Permissions.MailApiKeysManage) },
    (app) =>
      app
        .get("/api-keys", ({ userId }) => mailService.listApiKeys(userId!))
        .post(
          "/api-keys",
          async ({ userId, body, set }) => {
            try {
              return await mailService.createApiKey(userId!, body);
            } catch (error) {
              return handleMailError(error, set);
            }
          },
          { body: ApiKeyCreateDto },
        )
        .post("/api-keys/:id/revoke", async ({ userId, params: { id }, set }) => {
          try {
            return await mailService.revokeApiKey(userId!, id);
          } catch (error) {
            return handleMailError(error, set);
          }
        }),
  )
  .guard(
    { beforeHandle: requirePermission(Permissions.MailMailboxesManage) },
    (app) =>
      app
        .get("/mailboxes", ({ userId }) => mailService.listMailboxes(userId!))
        .post(
          "/mailboxes",
          async ({ userId, body, set }) => {
            try {
              return await mailService.createMailbox(userId!, body);
            } catch (error) {
              return handleMailError(error, set);
            }
          },
          { body: MailboxCreateDto },
        )
        .post("/mailboxes/:id/sync", async ({ userId, params: { id }, set }) => {
          try {
            return await mailService.syncMailboxForUser(userId!, id);
          } catch (error) {
            return handleMailError(error, set);
          }
        }),
  )
  .guard(
    { beforeHandle: requirePermission(Permissions.MailEmailsRead) },
    (app) =>
      app
        .get("/emails", ({ userId, query }) => mailService.listEmails(userId!, query), {
          query: EmailQueryDto,
        })
        .get("/emails/:id", async ({ userId, params: { id }, set }) => {
          const email = await mailService.getEmail(userId!, id);
          if (!email) {
            set.status = 404;
            return { message: "Email not found" };
          }
          return email;
        })
  )
  .guard(
    { beforeHandle: requirePermission(Permissions.MailInboundRead) },
    (app) =>
      app
        .get("/inbox", ({ userId, query }) => mailService.listInboundEmails(userId!, query), {
          query: InboundEmailQueryDto,
        })
        .get("/inbox/:id", async ({ userId, params: { id }, set }) => {
          const email = await mailService.getInboundEmail(userId!, id);
          if (!email) {
            set.status = 404;
            return { message: "Inbound email not found" };
          }
          return email;
        }),
  )
  .guard(
    { beforeHandle: requirePermission(Permissions.MailInboundManage) },
    (app) =>
      app
        .post(
          "/inbox/:id/status",
          async ({ userId, params: { id }, body, set }) => {
            try {
              return await mailService.updateInboundEmail(userId!, id, body);
            } catch (error) {
              return handleMailError(error, set);
            }
          },
          { body: InboundEmailUpdateDto },
        )
        .post(
          "/inbox/:id/reply",
          async ({ userId, params: { id }, body, set }) => {
            try {
              return await mailService.replyToInboundEmail(userId!, id, body);
            } catch (error) {
              return handleMailError(error, set);
            }
          },
          { body: InboundReplyDto },
        ),
  );
