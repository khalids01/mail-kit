import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  Permissions,
  RolePermissionMap,
  Roles,
} from "@rbac";
import { mockRedisModule } from "./rbac/helpers/mock-redis-module";

const { store } = mockRedisModule();

const listRolesMock = mock(async () => []);
const listAssignableRolesMock = mock(async () => []);
const listPermissionCatalogMock = mock(async () => []);
const getRoleByIdMock = mock(async () => null as any);
const createCustomRoleMock = mock(async () => ({
  id: "role-custom",
  slug: "custom.support",
  name: "Support",
  permissions: [Permissions.FeedbackSubmit],
}));
const replaceRolePermissionsMock = mock(async () => [Permissions.FeedbackSubmit]);
const resetRolePermissionsFromMapMock = mock(async () => ({
  roleId: "role-admin",
  permissions: RolePermissionMap[Roles.PlatformAdmin],
}));
const updateCustomRoleMetadataMock = mock(async () => ({
  id: "role-custom",
  slug: "custom.support",
  name: "Support Team",
}));
const deleteCustomRoleMock = mock(async () => ({
  id: "role-custom",
  slug: "custom.support",
  name: "Support",
}));
const getUserIdsForRoleMock = mock(async () => ["user-1"]);
const isAssignableRoleSlugMock = mock(async () => true);
const assignUserRoleAndInvalidateMock = mock(async () => undefined);
const activityRecordMock = mock(async () => null);

mock.module("@db/server/rbac/roles", () => ({
  listRoles: listRolesMock,
  listAssignableRoles: listAssignableRolesMock,
  listPermissionCatalog: listPermissionCatalogMock,
  getRoleById: getRoleByIdMock,
  createCustomRole: createCustomRoleMock,
  replaceRolePermissions: replaceRolePermissionsMock,
  resetRolePermissionsFromMap: resetRolePermissionsFromMapMock,
  updateCustomRoleMetadata: updateCustomRoleMetadataMock,
  deleteCustomRole: deleteCustomRoleMock,
  getUserIdsForRole: getUserIdsForRoleMock,
  isAssignableRoleSlug: isAssignableRoleSlugMock,
}));

mock.module("@/rbac/assignments", () => ({
  assignUserRoleAndInvalidate: assignUserRoleAndInvalidateMock,
}));

mock.module("../src/modules/admin/activity/activity.service", () => ({
  activityService: {
    record: activityRecordMock,
  },
}));

const ownerActor = {
  id: "owner-1",
  roleId: "role-owner",
  permissions: new Set(RolePermissionMap[Roles.PlatformOwner]),
};

describe("roles.service", () => {
  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    store.values.clear();
    store.ttl.clear();
    listRolesMock.mockClear();
    getRoleByIdMock.mockClear();
    replaceRolePermissionsMock.mockClear();
    resetRolePermissionsFromMapMock.mockClear();
    deleteCustomRoleMock.mockClear();
    getUserIdsForRoleMock.mockClear();
    isAssignableRoleSlugMock.mockClear();
    assignUserRoleAndInvalidateMock.mockClear();
    activityRecordMock.mockClear();
    getUserIdsForRoleMock.mockResolvedValue([]);
    isAssignableRoleSlugMock.mockResolvedValue(true);
  });

  it("updates role permissions and refreshes cache", async () => {
    getRoleByIdMock.mockResolvedValueOnce({
      id: "role-admin",
      slug: Roles.PlatformAdmin,
      name: "Admin",
      isProtected: false,
      isSystem: true,
      permissions: RolePermissionMap[Roles.PlatformAdmin],
      _count: { permissions: 10, userAssignments: 2 },
    });
    getRoleByIdMock.mockResolvedValueOnce({
      id: "role-admin",
      slug: Roles.PlatformAdmin,
      name: "Admin",
      isProtected: false,
      isSystem: true,
      permissions: [Permissions.FeedbackSubmit],
      _count: { permissions: 1, userAssignments: 2 },
    });
    listPermissionCatalogMock.mockResolvedValueOnce(
      Object.values(Permissions).map((name) => ({
        id: `perm-${name}`,
        name,
        group: name.split(".").slice(0, -1).join("."),
        description: null,
        isSystem: true,
      })),
    );

    const { rolesService } = await import("../src/modules/admin/roles/roles.service");
    const { getCachedRolePermissions } = await import(
      "../src/rbac/cache/role-permissions"
    );

    await rolesService.updateRolePermissions(
      "role-admin",
      [Permissions.FeedbackSubmit],
      ownerActor,
    );

    expect(replaceRolePermissionsMock).toHaveBeenCalledWith("role-admin", [
      Permissions.FeedbackSubmit,
    ]);
    expect(await getCachedRolePermissions("role-admin")).toEqual([
      Permissions.FeedbackSubmit,
    ]);
    expect(activityRecordMock).toHaveBeenCalled();
  });

  it("resets system role permissions from map", async () => {
    getRoleByIdMock.mockResolvedValueOnce({
      id: "role-admin",
      slug: Roles.PlatformAdmin,
      name: "Admin",
      isProtected: false,
      isSystem: true,
      permissions: [Permissions.FeedbackSubmit],
      _count: { permissions: 1, userAssignments: 0 },
    });
    getRoleByIdMock.mockResolvedValueOnce({
      id: "role-admin",
      slug: Roles.PlatformAdmin,
      name: "Admin",
      isProtected: false,
      isSystem: true,
      permissions: RolePermissionMap[Roles.PlatformAdmin],
      _count: {
        permissions: RolePermissionMap[Roles.PlatformAdmin].length,
        userAssignments: 0,
      },
    });

    const { rolesService } = await import("../src/modules/admin/roles/roles.service");

    await rolesService.resetRole("role-admin", ownerActor);

    expect(resetRolePermissionsFromMapMock).toHaveBeenCalledWith(Roles.PlatformAdmin);
    expect(activityRecordMock).toHaveBeenCalled();
  });

  it("invalidates assigned users when role metadata changes", async () => {
    getRoleByIdMock.mockResolvedValueOnce({
      id: "role-custom",
      slug: "custom.support",
      name: "Support",
      isProtected: false,
      isSystem: false,
      permissions: [Permissions.FeedbackSubmit],
      _count: { permissions: 1, userAssignments: 2 },
    });
    getUserIdsForRoleMock.mockResolvedValueOnce(["user-1", "user-2"]);

    const { rolesService } = await import("../src/modules/admin/roles/roles.service");
    const { setCachedUserSessionRbac, getCachedUserSessionRbac } = await import(
      "../src/rbac/cache/effective"
    );

    const cached = {
      permissions: [Permissions.FeedbackSubmit],
      roles: [{ id: "role-custom", slug: "custom.support", name: "Support" }],
      primaryRoleSlug: "custom.support",
      primaryRoleId: "role-custom",
      catalogVersion: 1,
      computedAt: new Date().toISOString(),
    } as never;

    await setCachedUserSessionRbac("user-1", cached);
    await setCachedUserSessionRbac("user-2", cached);
    await setCachedUserSessionRbac("user-3", cached);

    await rolesService.updateRoleMetadata(
      "role-custom",
      { name: "Support Team" },
      ownerActor,
    );

    expect(updateCustomRoleMetadataMock).toHaveBeenCalledWith("role-custom", {
      name: "Support Team",
    });
    expect(await getCachedUserSessionRbac("user-1")).toBeNull();
    expect(await getCachedUserSessionRbac("user-2")).toBeNull();
    expect(await getCachedUserSessionRbac("user-3")).not.toBeNull();
  });

  it("rejects permission updates for protected roles", async () => {
    getRoleByIdMock.mockResolvedValueOnce({
      id: "role-owner",
      slug: Roles.PlatformOwner,
      name: "Owner",
      isProtected: true,
      isSystem: true,
      permissions: RolePermissionMap[Roles.PlatformOwner],
      _count: { permissions: 20, userAssignments: 1 },
    });

    const { rolesService, RolesPolicyError } = await import(
      "../src/modules/admin/roles/roles.service"
    );

    await expect(
      rolesService.updateRolePermissions(
        "role-owner",
        [Permissions.AdminAccess],
        ownerActor,
      ),
    ).rejects.toBeInstanceOf(RolesPolicyError);
  });

  it("rejects permission updates for the actor's own assigned role", async () => {
    getRoleByIdMock.mockResolvedValueOnce({
      id: "role-admin",
      slug: Roles.PlatformAdmin,
      name: "Admin",
      isProtected: false,
      isSystem: true,
      permissions: RolePermissionMap[Roles.PlatformAdmin],
      _count: { permissions: 10, userAssignments: 2 },
    });

    const { rolesService, RolesPolicyError } = await import(
      "../src/modules/admin/roles/roles.service"
    );

    await expect(
      rolesService.updateRolePermissions(
        "role-admin",
        [Permissions.FeedbackSubmit],
        {
          id: "admin-1",
          roleId: "role-admin",
          permissions: new Set([
            ...RolePermissionMap[Roles.PlatformAdmin],
            Permissions.AdminRolesUpdate,
          ]),
        },
      ),
    ).rejects.toBeInstanceOf(RolesPolicyError);
  });

  it("deletes custom roles with no assigned users", async () => {
    getRoleByIdMock.mockResolvedValueOnce({
      id: "role-custom",
      slug: "custom.support",
      name: "Support",
      isProtected: false,
      isSystem: false,
      permissions: [Permissions.FeedbackSubmit],
      _count: { permissions: 1, userAssignments: 0 },
    });
    getUserIdsForRoleMock.mockResolvedValueOnce([]);

    const { rolesService } = await import("../src/modules/admin/roles/roles.service");

    await rolesService.deleteRole("role-custom", ownerActor);

    expect(deleteCustomRoleMock).toHaveBeenCalledWith("role-custom", { force: false });
    expect(assignUserRoleAndInvalidateMock).not.toHaveBeenCalled();
    expect(activityRecordMock).toHaveBeenCalled();
  });

  it("rejects delete when users are assigned without reassignment target", async () => {
    getRoleByIdMock.mockResolvedValueOnce({
      id: "role-custom",
      slug: "custom.support",
      name: "Support",
      isProtected: false,
      isSystem: false,
      permissions: [Permissions.FeedbackSubmit],
      _count: { permissions: 1, userAssignments: 2 },
    });
    getUserIdsForRoleMock.mockResolvedValueOnce(["user-1", "user-2"]);

    const { rolesService, RolesPolicyError } = await import(
      "../src/modules/admin/roles/roles.service"
    );

    await expect(rolesService.deleteRole("role-custom", ownerActor)).rejects.toMatchObject({
      message: expect.stringContaining("assigned to 2 users"),
      status: 409,
    });

    expect(deleteCustomRoleMock).not.toHaveBeenCalled();
    expect(assignUserRoleAndInvalidateMock).not.toHaveBeenCalled();
  });

  it("reassigns users and deletes custom roles when target is valid", async () => {
    getRoleByIdMock.mockResolvedValueOnce({
      id: "role-custom",
      slug: "custom.support",
      name: "Support",
      isProtected: false,
      isSystem: false,
      permissions: [Permissions.FeedbackSubmit],
      _count: { permissions: 1, userAssignments: 2 },
    });
    getRoleByIdMock.mockResolvedValueOnce({
      id: "role-user",
      slug: Roles.PlatformUser,
      name: "User",
      isProtected: false,
      isSystem: true,
      permissions: RolePermissionMap[Roles.PlatformUser],
      _count: { permissions: 5, userAssignments: 10 },
    });
    getUserIdsForRoleMock.mockResolvedValueOnce(["user-1", "user-2"]);

    const { rolesService } = await import("../src/modules/admin/roles/roles.service");

    await rolesService.deleteRole("role-custom", ownerActor, {
      reassignToRoleId: "role-user",
    });

    expect(assignUserRoleAndInvalidateMock).toHaveBeenCalledTimes(2);
    expect(assignUserRoleAndInvalidateMock).toHaveBeenCalledWith(
      "user-1",
      Roles.PlatformUser,
    );
    expect(assignUserRoleAndInvalidateMock).toHaveBeenCalledWith(
      "user-2",
      Roles.PlatformUser,
    );
    expect(deleteCustomRoleMock).toHaveBeenCalledWith("role-custom", { force: true });
  });

  it("rejects delete when reassignment target is the same role", async () => {
    getRoleByIdMock.mockResolvedValueOnce({
      id: "role-custom",
      slug: "custom.support",
      name: "Support",
      isProtected: false,
      isSystem: false,
      permissions: [Permissions.FeedbackSubmit],
      _count: { permissions: 1, userAssignments: 1 },
    });
    getRoleByIdMock.mockResolvedValueOnce({
      id: "role-custom",
      slug: "custom.support",
      name: "Support",
      isProtected: false,
      isSystem: false,
      permissions: [Permissions.FeedbackSubmit],
      _count: { permissions: 1, userAssignments: 1 },
    });
    getUserIdsForRoleMock.mockResolvedValueOnce(["user-1"]);

    const { rolesService, RolesPolicyError } = await import(
      "../src/modules/admin/roles/roles.service"
    );

    await expect(
      rolesService.deleteRole("role-custom", ownerActor, {
        reassignToRoleId: "role-custom",
      }),
    ).rejects.toBeInstanceOf(RolesPolicyError);

    expect(deleteCustomRoleMock).not.toHaveBeenCalled();
  });

  it("rejects deleting system roles", async () => {
    getRoleByIdMock.mockResolvedValueOnce({
      id: "role-admin",
      slug: Roles.PlatformAdmin,
      name: "Admin",
      isProtected: false,
      isSystem: true,
      permissions: RolePermissionMap[Roles.PlatformAdmin],
      _count: { permissions: 10, userAssignments: 0 },
    });

    const { rolesService, RolesPolicyError } = await import(
      "../src/modules/admin/roles/roles.service"
    );

    await expect(rolesService.deleteRole("role-admin", ownerActor)).rejects.toBeInstanceOf(
      RolesPolicyError,
    );

    expect(deleteCustomRoleMock).not.toHaveBeenCalled();
  });
});
