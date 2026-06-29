import { Elysia } from "elysia";
import { Permissions } from "@rbac";
import { adminModuleGuard } from "../admin-rbac.plugin";
import { requirePermission } from "@/rbac/guards/permissions.guard";
import { AdminMailQueryDto } from "@/modules/mail/mail.dto";
import { mailService, MailPolicyError } from "@/modules/mail/mail.service";

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

export const adminMailController = new Elysia({
  prefix: "/admin/mail",
  detail: { tags: ["Admin - Mail"] },
})
  .use(adminModuleGuard(Permissions.AdminMailRead))
  .get("/overview", () => mailService.getAdminOverview())
  .get("/domains", ({ query }) => mailService.listAdminDomains(query), {
    query: AdminMailQueryDto,
  })
  .get("/emails", ({ query }) => mailService.listAdminEmails(query), {
    query: AdminMailQueryDto,
  })
  .get("/api-keys", ({ query }) => mailService.listAdminApiKeys(query), {
    query: AdminMailQueryDto,
  })
  .guard(
    { beforeHandle: requirePermission(Permissions.AdminMailManage) },
    (app) =>
      app
        .post("/domains/:id/suspend", async ({ params: { id }, set }) => {
          try {
            return await mailService.suspendDomain(id);
          } catch (error) {
            return handleMailError(error, set);
          }
        })
        .post("/domains/:id/unsuspend", async ({ params: { id }, set }) => {
          try {
            return await mailService.unsuspendDomain(id);
          } catch (error) {
            return handleMailError(error, set);
          }
        })
        .post("/domains/:id/verify", async ({ params: { id }, set }) => {
          try {
            return await mailService.verifyDomainForAdmin(id);
          } catch (error) {
            return handleMailError(error, set);
          }
        }),
  );
