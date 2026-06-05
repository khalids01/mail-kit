import { getCache, setCache } from "../../../../redis/src/index.server";
import type { Permission } from "@rbac";
import { rolePermissionsKey } from "../keys";

export async function getCachedRolePermissions(
  roleId: string,
): Promise<Permission[] | null> {
  return getCache<Permission[]>(rolePermissionsKey(roleId));
}

export async function setCachedRolePermissions(
  roleId: string,
  permissions: Permission[],
) {
  await setCache(rolePermissionsKey(roleId), [...permissions].sort());
}
