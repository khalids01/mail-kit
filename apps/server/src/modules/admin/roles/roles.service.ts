import {
  createCustomRole,
  deleteCustomRole,
  getRoleById,
  getUserIdsForRole,
  isAssignableRoleSlug,
  listAssignableRoles,
  listPermissionCatalog,
  listRoles,
  replaceRolePermissions,
  resetRolePermissionsFromMap,
  updateCustomRoleMetadata,
} from "@db/server/rbac/roles";
import { type Permission } from "@rbac";
import { activityService } from "../activity/activity.service";
import { setCachedRolePermissions } from "@/rbac/cache/role-permissions";
import { assignUserRoleAndInvalidate } from "@/rbac/assignments";
import { invalidateRole } from "@/rbac/cache/invalidate";
import {
  assertActorCanGrantPermissions,
  assertActorCannotManageOwnRole,
  assertPermissionsAreCatalogOnly,
  assertRoleCanBeDeleted,
  assertRoleCanBeReset,
  assertRoleIsEditable,
  assertValidReassignTarget,
  RolesPolicyError,
} from "@/rbac/policies/roles.policy";

export type AdminActor = {
  id?: string;
  roleId?: string | null;
  permissions: ReadonlySet<Permission>;
};

function assertCanManageTargetRole(
  actor: AdminActor,
  targetRoleId: string,
  role: { isProtected: boolean },
) {
  assertRoleIsEditable({ isProtected: role.isProtected });
  assertActorCannotManageOwnRole({
    actorRoleId: actor.roleId,
    targetRoleId,
  });
}

function assertAuthenticatedActor(actor?: AdminActor) {
  if (!actor?.id) {
    throw new RolesPolicyError("Admin actor is required", 401);
  }
}

async function refreshRolePermissionCache(roleId: string, permissions: Permission[]) {
  await setCachedRolePermissions(roleId, permissions);
  const userIds = await getUserIdsForRole(roleId);
  await invalidateRole(roleId, userIds);
}

export class RolesService {
  async listRoles() {
    const roles = await listRoles();

    return roles.map((role) => ({
      id: role.id,
      slug: role.slug,
      name: role.name,
      scope: role.scope,
      isSystem: role.isSystem,
      isProtected: role.isProtected,
      customizedAt: role.customizedAt,
      permissionCount: role._count.permissions,
      userCount: role._count.userAssignments,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
  }

  async listAssignableRoles() {
    return listAssignableRoles();
  }

  async listPermissionCatalog() {
    return listPermissionCatalog();
  }

  async getRoleById(roleId: string) {
    const role = await getRoleById(roleId);

    if (!role) {
      return null;
    }

    const { permissions, _count, ...rest } = role;

    return {
      ...rest,
      permissions,
      permissionCount: _count.permissions,
      userCount: _count.userAssignments,
    };
  }

  async createRole(
    data: {
      slug: string;
      name: string;
      permissions?: Permission[];
    },
    actor: AdminActor,
  ) {
    assertAuthenticatedActor(actor);
    assertActorCanGrantPermissions({
      actorPermissions: actor.permissions,
      permissionNames: data.permissions ?? [],
    });

    const catalog = await listPermissionCatalog();
    const catalogNames = new Set(catalog.map((entry) => entry.name));
    assertPermissionsAreCatalogOnly(data.permissions ?? [], catalogNames);

    const role = await createCustomRole(data);

    await refreshRolePermissionCache(role.id, role.permissions);

    await activityService.record({
      type: "role.created",
      actorUserId: actor.id,
      message: `Role ${role.name} (${role.slug}) created`,
      metadata: {
        roleId: role.id,
        slug: role.slug,
        permissionCount: role.permissions.length,
      },
    });

    return role;
  }

  async updateRoleMetadata(
    roleId: string,
    data: { name: string },
    actor: AdminActor,
  ) {
    assertAuthenticatedActor(actor);

    const role = await getRoleById(roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    assertCanManageTargetRole(actor, roleId, role);

    const updated = await updateCustomRoleMetadata(roleId, data);
    const userIds = await getUserIdsForRole(roleId);
    await invalidateRole(roleId, userIds);

    await activityService.record({
      type: "role.updated",
      actorUserId: actor.id,
      message: `Role ${updated.slug} renamed to ${updated.name}`,
      metadata: {
        roleId: updated.id,
        slug: updated.slug,
      },
    });

    return updated;
  }

  async updateRolePermissions(
    roleId: string,
    permissions: Permission[],
    actor: AdminActor,
  ) {
    assertAuthenticatedActor(actor);

    const role = await getRoleById(roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    assertCanManageTargetRole(actor, roleId, role);

    const catalog = await listPermissionCatalog();
    const catalogNames = new Set(catalog.map((entry) => entry.name));
    assertPermissionsAreCatalogOnly(permissions, catalogNames);
    assertActorCanGrantPermissions({
      actorPermissions: actor.permissions,
      permissionNames: permissions,
    });

    const updatedPermissions = await replaceRolePermissions(roleId, permissions);
    await refreshRolePermissionCache(roleId, [...updatedPermissions]);

    await activityService.record({
      type: "role.permissions_updated",
      actorUserId: actor.id,
      message: `Permissions updated for role ${role.name} (${role.slug})`,
      metadata: {
        roleId,
        slug: role.slug,
        permissionCount: updatedPermissions.length,
      },
    });

    return this.getRoleById(roleId);
  }

  async resetRole(roleId: string, actor: AdminActor) {
    assertAuthenticatedActor(actor);

    const role = await getRoleById(roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    assertRoleCanBeReset({
      slug: role.slug,
      isProtected: role.isProtected,
      isSystem: role.isSystem,
    });
    assertActorCannotManageOwnRole({
      actorRoleId: actor.roleId,
      targetRoleId: roleId,
    });

    const result = await resetRolePermissionsFromMap(role.slug);
    await refreshRolePermissionCache(result.roleId, [...result.permissions]);

    await activityService.record({
      type: "role.reset",
      actorUserId: actor.id,
      message: `Role ${role.name} (${role.slug}) reset to defaults`,
      metadata: {
        roleId,
        slug: role.slug,
      },
    });

    return this.getRoleById(roleId);
  }

  async deleteRole(
    roleId: string,
    actor: AdminActor,
    options?: { reassignToRoleId?: string },
  ) {
    assertAuthenticatedActor(actor);

    const role = await getRoleById(roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    assertRoleCanBeDeleted({
      isSystem: role.isSystem,
      isProtected: role.isProtected,
    });
    assertActorCannotManageOwnRole({
      actorRoleId: actor.roleId,
      targetRoleId: roleId,
    });

    const userIds = await getUserIdsForRole(roleId);
    const userCount = userIds.length;

    if (userCount > 0) {
      if (!options?.reassignToRoleId) {
        throw new RolesPolicyError(
          `This role is assigned to ${userCount} users. Choose a role to move them to before deleting.`,
          409,
        );
      }

      const targetRole = await getRoleById(options.reassignToRoleId);
      if (!targetRole) {
        throw new RolesPolicyError("Reassignment target role not found", 404);
      }

      assertValidReassignTarget({
        sourceRoleId: roleId,
        targetRoleId: options.reassignToRoleId,
        targetIsProtected: targetRole.isProtected,
      });

      const assignable = await isAssignableRoleSlug(targetRole.slug);
      if (!assignable) {
        throw new RolesPolicyError(
          "Reassignment target role cannot be assigned to users",
          403,
        );
      }

      for (const userId of userIds) {
        await assignUserRoleAndInvalidate(userId, targetRole.slug);
      }
    }

    const deleted = await deleteCustomRole(roleId, {
      force: userCount > 0,
    });

    await activityService.record({
      type: "role.deleted",
      actorUserId: actor.id,
      message: `Role ${deleted.name} (${deleted.slug}) deleted`,
      metadata: {
        roleId: deleted.id,
        slug: deleted.slug,
        reassignedUserCount: userCount,
        reassignToRoleId: options?.reassignToRoleId ?? null,
      },
    });

    return { success: true };
  }
}

export const rolesService = new RolesService();

export { RolesPolicyError };
