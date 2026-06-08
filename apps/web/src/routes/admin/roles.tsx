import { createFileRoute} from "@tanstack/react-router";
import { RolesListPage } from "@/features/admin/roles/roles-list-page";
import { adminMiddleware } from "@/middleware/admin";

export const Route = createFileRoute("/admin/roles")({
  server: {
    middleware: [adminMiddleware],
  },

  component: RolesListPage,
});
