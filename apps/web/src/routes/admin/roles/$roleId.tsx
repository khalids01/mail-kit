import { createFileRoute, redirect } from "@tanstack/react-router";
import { Permissions } from "@rbac";
import { getRootSession } from "@/features/user/lib/get-root-session";
import { sessionHasPermission } from "@/features/user/lib/session-permissions";
import { RoleDetailPage } from "@/features/admin/roles/role-detail-page";

export const Route = createFileRoute("/admin/roles/$roleId")({
  beforeLoad: async ({ context }) => {
    const session = context.session ?? (await getRootSession());
    if (
      !sessionHasPermission(
        session?.permissions ?? [],
        Permissions.AdminRolesRead,
      )
    ) {
      throw redirect({ to: "/admin/overview" });
    }
  },
  component: RoleDetailRoute,
});

function RoleDetailRoute() {
  const { roleId } = Route.useParams();
  return <RoleDetailPage roleId={roleId} />;
}
