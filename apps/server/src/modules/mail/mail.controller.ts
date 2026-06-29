import { Elysia } from "elysia";
import { Permissions } from "@rbac";
import { authGuard } from "@/guards/auth.guard";
import { requirePermission } from "@/rbac/guards/permissions.guard";
import { mailService, MailPolicyError } from "./mail.service";
import { ApiKeyCreateDto, DomainCreateDto, EmailQueryDto, EmailSendDto } from "./mail.dto";

function handleMailError(error: unknown, set: { status?: number | string }) {
  if (error instanceof MailPolicyError) {
    set.status = error.status;
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
        }),
  );
