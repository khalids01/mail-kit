import prisma from "../../src/client.server";
import {
  AllPermissions,
  RoleDefinitions,
  permissionGroup,
  type Permission,
  type RoleSlug,
} from "@rbac";
import { syncAllRolePermissionsFromMap } from "../../src/rbac/sync-role-permissions.server";
import { getRedis, connectRedis } from "../../../redis/src/index.server";
import {
  RBAC_CATALOG_VERSION_KEY,
  rolePermissionsKey,
} from "./lib/rbac-keys";

const CATALOG_VERSION = 1;

async function upsertPermissions() {
  for (const name of AllPermissions) {
    await prisma.rbacPermission.upsert({
      where: { name },
      create: {
        name,
        group: permissionGroup(name),
        isSystem: true,
      },
      update: {
        group: permissionGroup(name),
        isSystem: true,
      },
    });
  }
}

async function upsertRoles() {
  const roles: Record<RoleSlug, { id: string }> = {} as Record<
    RoleSlug,
    { id: string }
  >;

  for (const definition of Object.values(RoleDefinitions)) {
    const role = await prisma.rbacRole.upsert({
      where: { slug: definition.slug },
      create: {
        slug: definition.slug,
        name: definition.name,
        scope: definition.scope,
        isSystem: definition.isSystem,
        isProtected: definition.isProtected,
        seedVersion: CATALOG_VERSION,
      },
      update: {
        name: definition.name,
        scope: definition.scope,
        isSystem: definition.isSystem,
        isProtected: definition.isProtected,
        seedVersion: CATALOG_VERSION,
      },
    });

    roles[definition.slug] = { id: role.id };
  }

  return roles;
}

async function warmRolePermissionCaches() {
  const redis = await connectRedis();

  await redis.set(RBAC_CATALOG_VERSION_KEY, String(CATALOG_VERSION));

  const roles = await prisma.rbacRole.findMany({
    select: {
      id: true,
      permissions: {
        select: {
          permission: {
            select: { name: true },
          },
        },
      },
    },
  });

  for (const role of roles) {
    const names = role.permissions.map(
      (entry) => entry.permission.name as Permission,
    );

    await redis.set(
      rolePermissionsKey(role.id),
      JSON.stringify(names.sort()),
    );
  }
}

export async function seedRbac() {
  await upsertPermissions();
  await upsertRoles();
  await syncAllRolePermissionsFromMap();

  try {
    await warmRolePermissionCaches();
  } catch (error) {
    console.warn("[rbac seed] Redis warm skipped:", error);
  }
}

if (import.meta.main) {
  await seedRbac();
  console.log("RBAC seed completed");
  await prisma.$disconnect();
  try {
    const redis = getRedis();
    if (redis.status === "ready") {
      await redis.quit();
    }
  } catch {
    // Redis optional during seed
  }
}
