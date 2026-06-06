import { createFileRoute, redirect } from "@tanstack/react-router";
import { Permissions } from "@rbac";
import { getRootSession } from "@/features/user/lib/get-root-session";
import { sessionHasPermission } from "@/features/user/lib/session-permissions";
import { RolesListPage } from "@/features/admin/roles/roles-list-page";

export const Route = createFileRoute("/admin/roles")({
  beforeLoad: async ({ context }) => {
    const session = context.session ?? (await getRootSession());
    if (
      !sessionHasPermission(
        session?.permissions ?? [],
        Permissions.AdminRolesList,
      )
    ) {
      throw redirect({ to: "/admin/overview" });
    }
  },
  component: RolesListPage,
});
