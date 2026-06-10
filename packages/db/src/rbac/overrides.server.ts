import type { Permission, PermissionEffect } from "@rbac";
import prisma from "../client.server";
import { invalidateUser } from "./cache/invalidate.server";

async function getPermissionId(name: Permission) {
  const permission = await prisma.rbacPermission.findUnique({
    where: { name },
    select: { id: true },
  });

  if (!permission) {
    throw new Error(`RBAC permission not found: ${name}`);
  }

  return permission.id;
}

export async function setUserPermissionOverride(
  userId: string,
  permissionName: Permission,
  effect: PermissionEffect,
) {
  const permissionId = await getPermissionId(permissionName);

  await prisma.$transaction([
    prisma.rbacUserPermissionOverride.deleteMany({
      where: {
        userId,
        permissionId,
      },
    }),
    prisma.rbacUserPermissionOverride.create({
      data: {
        userId,
        permissionId,
        effect,
      },
    }),
  ]);

  await invalidateUser(userId);
}

export async function clearUserPermissionOverride(
  userId: string,
  permissionName: Permission,
) {
  const permissionId = await getPermissionId(permissionName);

  await prisma.rbacUserPermissionOverride.deleteMany({
    where: {
      userId,
      permissionId,
    },
  });

  await invalidateUser(userId);
}
