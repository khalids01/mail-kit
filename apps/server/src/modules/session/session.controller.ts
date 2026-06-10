import { Elysia } from "elysia";
import { toClientSession } from "@auth/client";
import { authGuard } from "@/guards/auth.guard";

export const sessionController = new Elysia({
  prefix: "/session",
  detail: { tags: ["Session"] },
})
  .use(authGuard)
  .get(
    "/context",
    async ({ session, userId, set }) => {
      set.headers["cache-control"] = "private, no-store";

      if (!session || !userId) {
        return { user: null, permissions: [], roles: [], primaryRoleSlug: null, primaryRoleId: null };
      }

      const clientSession = toClientSession(session);

      if (!clientSession) {
        return { user: null, permissions: [], roles: [], primaryRoleSlug: null, primaryRoleId: null };
      }

      return {
        user: clientSession.user,
        permissions: clientSession.permissions,
        roles: clientSession.roles,
        primaryRoleSlug: clientSession.primaryRoleSlug,
        primaryRoleId: clientSession.primaryRoleId,
      };
    },
    {
      detail: { summary: "Authenticated session context with permissions" },
    },
  );
