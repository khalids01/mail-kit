import { Permissions, Roles, hasPermission, type Permission, type RoleSlug } from "@rbac";

export class RbacPolicyError extends Error {
  status = 403;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

function policyError(message: string, status = 403): never {
  throw new RbacPolicyError(message, status);
}

export function actorCanManageOwners(
  permissions: ReadonlySet<Permission> | readonly Permission[],
) {
  return hasPermission(permissions, Permissions.AdminUsersGrantAdmin);
}

export function isOwnerRole(slug: RoleSlug | string | null | undefined) {
  return slug === Roles.PlatformOwner;
}

export function isAdminRole(slug: RoleSlug | string | null | undefined) {
  return slug === Roles.PlatformAdmin;
}

export function assertActorCanAccessOwnerTarget(args: {
  actorPermissions: ReadonlySet<Permission> | readonly Permission[];
  targetRoleSlug: RoleSlug | string | null | undefined;
}) {
  if (
    isOwnerRole(args.targetRoleSlug) &&
    !actorCanManageOwners(args.actorPermissions)
  ) {
    policyError("Only owners can access owner accounts");
  }
}

export function assertActorCanGrantAdminRole(args: {
  actorPermissions: ReadonlySet<Permission> | readonly Permission[];
  nextRoleSlug?: RoleSlug | string | null;
}) {
  if (
    isAdminRole(args.nextRoleSlug) &&
    !actorCanManageOwners(args.actorPermissions)
  ) {
    policyError("Only owners can grant admin role");
  }
}

export function assertNotAssignableOwnerRole(roleSlug?: RoleSlug | string | null) {
  if (isOwnerRole(roleSlug)) {
    throw new Error("Owner role cannot be assigned from user management");
  }
}

export function assertOwnerRoleIsImmutable(args: {
  targetRoleSlug: RoleSlug | string | null | undefined;
  nextRoleSlug?: RoleSlug | string | null;
}) {
  if (
    isOwnerRole(args.targetRoleSlug) &&
    args.nextRoleSlug !== undefined &&
    !isOwnerRole(args.nextRoleSlug)
  ) {
    policyError("The owner role cannot be changed");
  }
}

export function assertActorCanChangePrivilegedAccounts(args: {
  actorPermissions: ReadonlySet<Permission> | readonly Permission[];
  targetRoleSlug: RoleSlug | string | null | undefined;
}) {
  const privileged =
    isOwnerRole(args.targetRoleSlug) || isAdminRole(args.targetRoleSlug);

  if (privileged && !actorCanManageOwners(args.actorPermissions)) {
    policyError("Only owners can change admin or owner accounts");
  }
}

export function assertOwnerAccountCannotBeDisabled(args: {
  targetRoleSlug: RoleSlug | string | null | undefined;
}) {
  if (isOwnerRole(args.targetRoleSlug)) {
    policyError("Owner accounts cannot be banned, archived, or deleted");
  }
}

export function assertNotSelfTarget(args: {
  actorId?: string;
  targetId: string;
  action: string;
}) {
  if (args.actorId === args.targetId) {
    policyError(`You cannot ${args.action} your own account`);
  }
}

export function shouldHideOwnerUsers(
  permissions: ReadonlySet<Permission> | readonly Permission[],
) {
  return !actorCanManageOwners(permissions);
}

export function filterOwnerUsers<T extends { role: { slug: string } }>(
  users: T[],
  permissions: ReadonlySet<Permission> | readonly Permission[],
) {
  if (!shouldHideOwnerUsers(permissions)) {
    return users;
  }

  return users.filter((user) => !isOwnerRole(user.role.slug));
}
