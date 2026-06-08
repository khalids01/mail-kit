import { createMiddleware } from "@tanstack/react-start";

import { getRootSession } from "@/features/user/lib/get-root-session";
import { sessionHasPermission } from "@/features/user/lib/session-permissions";
import { Roles, Permissions } from "@rbac";
import { redirect } from "@tanstack/react-router";

function canAccessAdmin(session: {
  permissions: readonly string[];
  primaryRoleSlug: string;
}) {
 
  return (
    sessionHasPermission(session.permissions, Permissions.AdminAccess) ||
    session.primaryRoleSlug === Roles.PlatformOwner 
  );
}


export const adminMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await getRootSession();

  if (!session) {
    throw redirect({ to: "/login" });
  }

  if (!canAccessAdmin(session)) {
    throw redirect({ to: "/dashboard" });
  }

  return next({
    context: { session },
  });
});

