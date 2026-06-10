import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Permissions, Roles } from "@rbac";
import { mockRedisModule } from "./helpers/mock-redis-module";

const { store } = mockRedisModule();

const findFirstMock = mock(async () => null as any);
const findUniqueMock = mock(async () => ({ id: "role-id" }));
const permissionFindUniqueMock = mock(async () => ({ id: "permission-id" }));
const deleteManyMock = mock(async () => ({ count: 0 }));
const createMock = mock(async () => ({}));
const overrideDeleteManyMock = mock(async () => ({ count: 0 }));
const overrideCreateMock = mock(async () => ({}));
const transactionMock = mock(async (operations: Promise<unknown>[]) =>
  Promise.all(operations),
);

mock.module("../../../../packages/db/src/client.server", () => ({
  default: {
    rbacUserRole: {
      findFirst: findFirstMock,
      deleteMany: deleteManyMock,
      create: createMock,
    },
    rbacRole: {
      findUnique: findUniqueMock,
    },
    rbacPermission: {
      findUnique: permissionFindUniqueMock,
    },
    rbacUserPermissionOverride: {
      deleteMany: overrideDeleteManyMock,
      create: overrideCreateMock,
    },
    $transaction: transactionMock,
  },
}));

describe("assignUserRole", () => {
  beforeEach(() => {
    store.values.clear();
    store.ttl.clear();
    findFirstMock.mockClear();
    findUniqueMock.mockClear();
    permissionFindUniqueMock.mockClear();
    deleteManyMock.mockClear();
    createMock.mockClear();
    overrideDeleteManyMock.mockClear();
    overrideCreateMock.mockClear();
    transactionMock.mockClear();
    findUniqueMock.mockResolvedValue({ id: "role-id" });
    permissionFindUniqueMock.mockResolvedValue({ id: "permission-id" });
    findFirstMock.mockResolvedValue(null);
  });

  it("blocks demoting an owner account", async () => {
    findFirstMock.mockResolvedValueOnce({
      role: { slug: Roles.PlatformOwner },
    });

    const { assignUserRole } = await import(
      "../../../../packages/db/src/rbac/assignments.server"
    );

    await expect(
      assignUserRole("user-1", Roles.PlatformUser),
    ).rejects.toThrow("Owner role cannot be changed");

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("does not invalidate cache when assignment fails", async () => {
    findFirstMock.mockResolvedValueOnce({
      role: { slug: Roles.PlatformOwner },
    });

    const { setCachedUserSessionRbac, getCachedUserSessionRbac } = await import(
      "../../../../packages/db/src/rbac/cache/effective.server"
    );
    const { assignUserRole } = await import(
      "../../../../packages/db/src/rbac/assignments.server"
    );

    await setCachedUserSessionRbac("user-1", {
      permissions: [],
      roles: [],
      primaryRoleSlug: Roles.PlatformOwner,
      primaryRoleId: "role-owner",
      catalogVersion: 1,
      computedAt: new Date().toISOString(),
    });

    await expect(
      assignUserRole("user-1", Roles.PlatformUser),
    ).rejects.toThrow("Owner role cannot be changed");

    expect(await getCachedUserSessionRbac("user-1")).not.toBeNull();
  });

  it("blocks assigning owner role outside bootstrap", async () => {
    const { assignUserRole } = await import(
      "../../../../packages/db/src/rbac/assignments.server"
    );

    await expect(
      assignUserRole("user-1", Roles.PlatformOwner),
    ).rejects.toThrow("Owner role cannot be assigned except during bootstrap");

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("allows owner bootstrap assignment", async () => {
    const { assignUserRole } = await import(
      "../../../../packages/db/src/rbac/assignments.server"
    );

    await assignUserRole("user-1", Roles.PlatformOwner, {
      allowOwnerAssignment: true,
    });

    expect(transactionMock).toHaveBeenCalled();
    expect(deleteManyMock).toHaveBeenCalled();
    expect(createMock).toHaveBeenCalled();
  });

  it("invalidates user session rbac cache after assignment succeeds", async () => {
    const { setCachedUserSessionRbac, getCachedUserSessionRbac } = await import(
      "../../../../packages/db/src/rbac/cache/effective.server"
    );
    const { assignUserRole } = await import(
      "../../../../packages/db/src/rbac/assignments.server"
    );

    await setCachedUserSessionRbac("user-1", {
      permissions: [],
      roles: [],
      primaryRoleSlug: Roles.PlatformUser,
      primaryRoleId: "role-user",
      catalogVersion: 1,
      computedAt: new Date().toISOString(),
    });

    await assignUserRole("user-1", Roles.PlatformAdmin);

    expect(await getCachedUserSessionRbac("user-1")).toBeNull();
  });
});

describe("user permission overrides", () => {
  beforeEach(() => {
    store.values.clear();
    store.ttl.clear();
    permissionFindUniqueMock.mockClear();
    overrideDeleteManyMock.mockClear();
    overrideCreateMock.mockClear();
    transactionMock.mockClear();
    permissionFindUniqueMock.mockResolvedValue({ id: "permission-id" });
  });

  it("sets one override effect and invalidates only the affected user", async () => {
    const { setCachedUserSessionRbac, getCachedUserSessionRbac } = await import(
      "../../../../packages/db/src/rbac/cache/effective.server"
    );
    const { setUserPermissionOverride } = await import(
      "../../../../packages/db/src/rbac/overrides.server"
    );

    const payload = {
      permissions: [Permissions.FeedbackSubmit],
      roles: [],
      primaryRoleSlug: Roles.PlatformUser,
      primaryRoleId: "role-user",
      catalogVersion: 1,
      computedAt: new Date().toISOString(),
    };

    await setCachedUserSessionRbac("user-1", payload);
    await setCachedUserSessionRbac("user-2", payload);

    await setUserPermissionOverride(
      "user-1",
      Permissions.FeedbackSubmit,
      "deny",
    );

    expect(permissionFindUniqueMock).toHaveBeenCalledWith({
      where: { name: Permissions.FeedbackSubmit },
      select: { id: true },
    });
    expect(overrideDeleteManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        permissionId: "permission-id",
      },
    });
    expect(overrideCreateMock).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        permissionId: "permission-id",
        effect: "deny",
      },
    });
    expect(await getCachedUserSessionRbac("user-1")).toBeNull();
    expect(await getCachedUserSessionRbac("user-2")).not.toBeNull();
  });

  it("does not invalidate cache when override permission lookup fails", async () => {
    permissionFindUniqueMock.mockResolvedValueOnce(null);

    const { setCachedUserSessionRbac, getCachedUserSessionRbac } = await import(
      "../../../../packages/db/src/rbac/cache/effective.server"
    );
    const { setUserPermissionOverride } = await import(
      "../../../../packages/db/src/rbac/overrides.server"
    );

    await setCachedUserSessionRbac("user-1", {
      permissions: [Permissions.FeedbackSubmit],
      roles: [],
      primaryRoleSlug: Roles.PlatformUser,
      primaryRoleId: "role-user",
      catalogVersion: 1,
      computedAt: new Date().toISOString(),
    });

    await expect(
      setUserPermissionOverride("user-1", Permissions.FeedbackSubmit, "deny"),
    ).rejects.toThrow("RBAC permission not found");

    expect(await getCachedUserSessionRbac("user-1")).not.toBeNull();
    expect(overrideCreateMock).not.toHaveBeenCalled();
  });
});
