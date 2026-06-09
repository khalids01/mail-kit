import prisma from "@db/server";
import { getRoleIdBySlug } from "@db/server/rbac/assignments";
import { isAssignableRoleSlug } from "@db/server/rbac/roles";
import {
  formatRoleLabel,
  Roles,
  type Permission,
  type RoleSlug,
} from "@rbac";
import { sendEmail, invitationTemplate } from "@email/server";
import { env } from "@env/server";
import { siteConfig } from "@config";
import { activityService } from "../activity/activity.service";
import {
  assertActorCanAccessOwnerTarget,
  assertActorCanChangePrivilegedAccounts,
  assertActorCanGrantAdminRole,
  assertNotAssignableOwnerRole,
  assertNotSelfTarget,
  assertOwnerAccountCannotBeDisabled,
  assertOwnerRoleIsImmutable,
  filterOwnerUsers,
  isOwnerRole,
} from "@/rbac/policies/owner.policy";
import { assignUserRoleAndInvalidate } from "@/rbac/assignments";

const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  createdAt: true,
  updatedAt: true,
  banned: true,
  banReason: true,
  archived: true,
  onboardingComplete: true,
  plan: true,
  subscriptionStatus: true,
  rbacRoles: {
    take: 1,
    select: {
      role: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  },
} as const;

function mapAdminUser<
  T extends {
    rbacRoles: Array<{ role: { slug: string; name: string } }>;
  },
>(user: T) {
  const { rbacRoles, ...rest } = user;
  const assignment = rbacRoles[0]?.role;
  return {
    ...rest,
    role: assignment
      ? { slug: assignment.slug, name: assignment.name }
      : { slug: Roles.PlatformUser, name: formatRoleLabel(Roles.PlatformUser) },
  };
}

export type AdminActor = {
  id?: string;
  permissions: ReadonlySet<Permission>;
};

class AdminUserPolicyError extends Error {
  status = 403;
}

function policyError(message: string): never {
  throw new AdminUserPolicyError(message);
}

function normalizePagination(page?: number, limit?: number) {
  const normalizedLimit = Math.min(Math.max(limit ?? 10, 1), 100);
  const normalizedPage = Math.max(page ?? 1, 1);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
  };
}

function assertAuthenticatedActor(actor?: AdminActor) {
  if (!actor?.id) {
    policyError("Admin actor is required");
  }
}

async function getAdminTargetUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      rbacRoles: {
        take: 1,
        select: {
          role: {
            select: { slug: true },
          },
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const roleSlug =
    user.rbacRoles[0]?.role.slug ?? Roles.PlatformUser;

  return { id: user.id, roleSlug: roleSlug as RoleSlug };
}

async function assertCanUpdateUser(args: {
  actor: AdminActor;
  targetId: string;
  data: { roleSlug?: string };
}) {
  assertAuthenticatedActor(args.actor);
  assertNotAssignableOwnerRole(args.data.roleSlug);

  if (args.data.roleSlug) {
    const assignable = await isAssignableRoleSlug(args.data.roleSlug);
    if (!assignable) {
      throw new Error("Role cannot be assigned to users");
    }
  }

  const target = await getAdminTargetUser(args.targetId);

  if (args.data.roleSlug) {
    assertOwnerRoleIsImmutable({
      targetRoleSlug: target.roleSlug,
      nextRoleSlug: args.data.roleSlug,
    });
  }

  assertActorCanAccessOwnerTarget({
    actorPermissions: args.actor.permissions,
    targetRoleSlug: target.roleSlug,
  });

  assertActorCanGrantAdminRole({
    actorPermissions: args.actor.permissions,
    nextRoleSlug: args.data.roleSlug,
  });
}

async function assertCanUseDestructiveAction(args: {
  actor: AdminActor;
  targetId: string;
  action: "ban" | "archive" | "delete";
}) {
  assertAuthenticatedActor(args.actor);

  assertNotSelfTarget({
    actorId: args.actor.id,
    targetId: args.targetId,
    action: args.action,
  });

  const target = await getAdminTargetUser(args.targetId);

  assertActorCanChangePrivilegedAccounts({
    actorPermissions: args.actor.permissions,
    targetRoleSlug: target.roleSlug,
  });

  assertOwnerAccountCannotBeDisabled({
    targetRoleSlug: target.roleSlug,
  });
}

export class UsersService {
  async listUsers(
    query: {
      page?: number;
      limit?: number;
      search?: string;
      roleSlug?: RoleSlug;
      banned?: boolean;
      archived?: boolean;
    },
    actor?: AdminActor,
  ) {
    const { search, roleSlug, banned, archived } = query;
    const { page, limit } = normalizePagination(query.page, query.limit);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (roleSlug) {
      where.rbacRoles = {
        some: {
          role: {
            slug: roleSlug,
          },
        },
      };
    }
    if (banned !== undefined) where.banned = banned;
    if (archived !== undefined) where.archived = archived;

    const [rawUsers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: adminUserSelect,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    const users = (actor
      ? filterOwnerUsers(
          rawUsers.map((user) => mapAdminUser(user)),
          actor.permissions,
        )
      : rawUsers.map((user) => mapAdminUser(user)));

    return {
      users,
      total: actor ? users.length : total,
      pages: Math.ceil((actor ? users.length : total) / limit),
    };
  }

  async getUserById(id: string, actor?: AdminActor) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        ...adminUserSelect,
        invitations: {
          select: {
            id: true,
            email: true,
            role: {
              select: {
                slug: true,
                name: true,
              },
            },
            expiresAt: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const mapped = mapAdminUser(user);

    if (actor && isOwnerRole(mapped.role.slug)) {
      try {
        assertActorCanAccessOwnerTarget({
          actorPermissions: actor.permissions,
          targetRoleSlug: mapped.role.slug,
        });
      } catch {
        return null;
      }
    }

    return {
      ...mapped,
      invitations: user.invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
        createdAt: invitation.createdAt,
      })),
    };
  }

  async updateUser(
    id: string,
    data: { name?: string; roleSlug?: string },
    actor: AdminActor,
  ) {
    await assertCanUpdateUser({
      actor,
      targetId: id,
      data,
    });

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
      },
      select: adminUserSelect,
    });

    if (data.roleSlug) {
      await assignUserRoleAndInvalidate(id, data.roleSlug);

      const assignedRole = await prisma.rbacRole.findUnique({
        where: { slug: data.roleSlug },
        select: { name: true },
      });
      const roleLabel = assignedRole?.name ?? data.roleSlug;

      await activityService.record({
        type: "user.role_updated",
        actorUserId: actor.id,
        targetUserId: id,
        message: `${user.name} role changed to ${roleLabel}`,
        metadata: {
          roleSlug: data.roleSlug,
          email: user.email,
        },
      });
    }

    const refreshed = await prisma.user.findUnique({
      where: { id },
      select: adminUserSelect,
    });

    return mapAdminUser(refreshed ?? user);
  }

  async banUser(id: string, reason: string | undefined, actor: AdminActor) {
    await assertCanUseDestructiveAction({
      actor,
      targetId: id,
      action: "ban",
    });

    const user = await prisma.user.update({
      where: { id },
      data: { banned: true, banReason: reason },
      select: adminUserSelect,
    });

    await activityService.record({
      type: "user.banned",
      actorUserId: actor.id,
      targetUserId: id,
      severity: "warning",
      message: `${user.name} was banned`,
      metadata: {
        email: user.email,
        reason: reason ?? null,
      },
    });

    return mapAdminUser(user);
  }

  async unbanUser(id: string, actor: AdminActor) {
    const user = await prisma.user.update({
      where: { id },
      data: { banned: false, banReason: null },
      select: adminUserSelect,
    });

    await activityService.record({
      type: "user.unbanned",
      actorUserId: actor.id,
      targetUserId: id,
      message: `${user.name} was unbanned`,
      metadata: {
        email: user.email,
      },
    });

    return mapAdminUser(user);
  }

  async archiveUser(id: string, actor: AdminActor) {
    await assertCanUseDestructiveAction({
      actor,
      targetId: id,
      action: "archive",
    });

    const user = await prisma.user.update({
      where: { id },
      data: { archived: true },
      select: adminUserSelect,
    });

    await activityService.record({
      type: "user.archived",
      actorUserId: actor.id,
      targetUserId: id,
      severity: "warning",
      message: `${user.name} was archived`,
      metadata: {
        email: user.email,
      },
    });

    return mapAdminUser(user);
  }

  async restoreUser(id: string, actor: AdminActor) {
    const user = await prisma.user.update({
      where: { id },
      data: { archived: false },
      select: adminUserSelect,
    });

    await activityService.record({
      type: "user.restored",
      actorUserId: actor.id,
      targetUserId: id,
      message: `${user.name} was restored`,
      metadata: {
        email: user.email,
      },
    });

    return mapAdminUser(user);
  }

  async deleteUserPermanent(id: string, actor: AdminActor) {
    await assertCanUseDestructiveAction({
      actor,
      targetId: id,
      action: "delete",
    });

    const user = await prisma.user.delete({
      where: { id },
      select: adminUserSelect,
    });

    return mapAdminUser(user);
  }

  async inviteUser(
    email: string,
    roleSlug: RoleSlug = Roles.PlatformUser,
    inviterId: string,
  ) {
    assertNotAssignableOwnerRole(roleSlug);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error("User already exists");

    const inviter = await prisma.user.findUnique({ where: { id: inviterId } });
    const inviterName = inviter?.name || "A team member";
    const roleId = await getRoleIdBySlug(roleSlug);

    const invitation = await prisma.invitation.create({
      data: {
        id: crypto.randomUUID(),
        email,
        roleId,
        inviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      include: {
        role: {
          select: {
            slug: true,
            name: true,
          },
        },
      },
    });

    const inviteUrl = `${env.CORS_ORIGIN}/accept-invitation?id=${invitation.id}`;
    const roleLabel = formatRoleLabel(roleSlug);
    await sendEmail({
      to: email,
      subject: `Invitation: Join ${siteConfig.name} as ${roleLabel}`,
      html: await invitationTemplate({
        inviteUrl,
        inviterName,
        invitedEmail: email,
        roleLabel,
        expiresInDays: 7,
      }),
    });

    await activityService.record({
      type: "user.invited",
      actorUserId: inviterId,
      message: `${email} was invited as ${roleLabel}`,
      metadata: {
        email,
        roleSlug,
        invitationId: invitation.id,
      },
    });

    return invitation;
  }

  async getUserSessions(id: string) {
    return prisma.session.findMany({
      where: { userId: id },
      select: {
        id: true,
        expiresAt: true,
        createdAt: true,
        ipAddress: true,
        userAgent: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const usersService = new UsersService();
export { AdminUserPolicyError };
