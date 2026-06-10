import { createFileRoute, redirect } from "@tanstack/react-router";
import { canAccessAdminRolesRead } from "@/features/admin/lib/admin-access";
import { getRootSession } from "@/features/user/lib/get-root-session";
import { RoleDetailPage } from "@/features/admin/roles/role-detail-page";
import { adminMiddleware } from "@/middleware/admin";

export const Route = createFileRoute("/admin/roles/$roleId")({
  server: {
    middleware: [adminMiddleware],
  },
  beforeLoad: async ({ context }) => {
    const session = context.session ?? (await getRootSession());

    if (!canAccessAdminRolesRead(session)) {
      throw redirect({ to: "/admin/overview" });
    }
  },
  component: RoleDetailRoute,
});

function RoleDetailRoute() {
  const { roleId } = Route.useParams();
  return <RoleDetailPage roleId={roleId} />;
}
