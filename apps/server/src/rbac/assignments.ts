import { assignUserRole as dbAssignUserRole } from "@db/server/rbac/assignments";

export async function assignUserRoleAndInvalidate(
  userId: string,
  slug: string,
  options?: { allowOwnerAssignment?: boolean },
) {
  await dbAssignUserRole(userId, slug, options);
}
