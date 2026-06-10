import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Permissions, RolePermissionMap, Roles } from "@rbac";
import { createTestGraph, expectedPermissionsForUser } from "./helpers/fixtures";
import { createRbacPrismaMock } from "./helpers/mock-prisma-rbac";
import { mockRedisModule } from "./helpers/mock-redis-module";

const graph = createTestGraph({
  users: {
    admin: { roleSlugs: [Roles.PlatformAdmin] },
    owner: { roleSlugs: [Roles.PlatformOwner] },
  },
});

const { store, redis: redisMock } = mockRedisModule();

let getCacheCalls = 0;

mock.module("@db/server/rbac/prisma", () => ({
  default: createRbacPrismaMock(graph),
}));

const originalGet = redisMock.get.bind(redisMock);
redisMock.get = async (key: string) => {
  getCacheCalls += 1;
  return originalGet(key);
};

describe("rbac resolve", () => {
  beforeEach(() => {
    store.values.clear();
    getCacheCalls = 0;
    redisMock.set("rbac:catalog:version", "1");
  });

  afterEach(() => {
    store.values.clear();
  });

  it("computes admin effective permissions from graph", async () => {
    const { getEffectivePermissions } = await import(
      "../../src/rbac/resolve/get-effective"
    );

    const permissions = await getEffectivePermissions("admin");
    const expected = expectedPermissionsForUser(graph, "admin");

    for (const permission of expected) {
      expect(permissions.has(permission)).toBe(true);
    }

    expect(permissions.has(Permissions.AdminUsersGrantAdmin)).toBe(false);
    expect(permissions.has(Permissions.AdminAccess)).toBe(true);
  });

  it("uses effective cache on second lookup", async () => {
    const { getEffectivePermissions } = await import(
      "../../src/rbac/resolve/get-effective"
    );

    await getEffectivePermissions("owner");
    const callsAfterFirst = getCacheCalls;

    await getEffectivePermissions("owner");
    expect(getCacheCalls - callsAfterFirst).toBe(1);

    const second = await getEffectivePermissions("owner");
    expect(second.has(Permissions.AdminUsersGrantAdmin)).toBe(true);
    expect(second.size).toBe(RolePermissionMap[Roles.PlatformOwner].length);
  });
});
