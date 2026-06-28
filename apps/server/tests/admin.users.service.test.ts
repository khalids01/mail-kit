import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { RolePermissionMap, Roles } from "@rbac";
import { Prisma } from "../../../packages/db/prisma/generated/client";
import * as rbacAssignments from "../../../packages/db/src/rbac/assignments.server";

const sessionFindManyMock = mock(async () => []);
const userFindManyMock = mock(async () => []);
const userCountMock = mock(async () => 0);
const userFindUniqueMock = mock(async (): Promise<any> => null);
const userUpdateMock = mock(async (): Promise<any> => null);
const userDeleteMock = mock(async (): Promise<any> => null);
const invitationCreateMock = mock(async () => ({ id: "invitation-1" }));
const activityRecordMock = mock(async () => null);
const adminActor = {
  id: "admin-1",
  permissions: new Set(RolePermissionMap[Roles.PlatformAdmin]),
};
const ownerActor = {
  id: "owner-1",
  permissions: new Set(RolePermissionMap[Roles.PlatformOwner]),
};

const assignUserRoleAndInvalidateMock = mock(async () => undefined);
const countActivePlatformOwnersMock = mock(async () => 2);
const getRoleIdBySlugMock = mock(async () => "role-user-id");
const isAssignableRoleSlugMock = mock(async (slug: string) => slug !== Roles.PlatformOwner);
const rbacRoleFindUniqueMock = mock(async ({ where }: { where: { slug: string } }) => {
  if (where.slug === Roles.PlatformAdmin) {
    return { name: "Admin" };
  }

  if (where.slug === Roles.PlatformUser) {
    return { name: "User" };
  }

  return { name: where.slug };
});

const safeAdminUserSelect = {
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
};

const sampleRbacRoles = [
  {
    role: {
      slug: Roles.PlatformUser,
      name: "User",
    },
  },
];

mock.module("@db/server", () => ({
  default: {
    user: {
      findMany: userFindManyMock,
      count: userCountMock,
      findUnique: userFindUniqueMock,
      update: userUpdateMock,
      delete: userDeleteMock,
    },
    session: {
      findMany: sessionFindManyMock,
    },
    invitation: {
      create: invitationCreateMock,
    },
    rbacRole: {
      findUnique: rbacRoleFindUniqueMock,
    },
  },
  Prisma,
}));

mock.module("@db/server/rbac/roles", () => ({
  isAssignableRoleSlug: isAssignableRoleSlugMock,
}));

mock.module("@db/server/rbac/assignments", () => ({
  ...rbacAssignments,
  countActivePlatformOwners: countActivePlatformOwnersMock,
  getRoleIdBySlug: getRoleIdBySlugMock,
}));

mock.module("../src/modules/admin/activity/activity.service", () => ({
  activityService: {
    record: activityRecordMock,
  },
}));

mock.module("@email/server", () => ({
  sendEmail: mock(async () => undefined),
  invitationTemplate: mock(async () => "<p>Invitation</p>"),
}));

mock.module("@env/server", () => ({
  env: {
    CORS_ORIGIN: "http://localhost:5006",
  },
}));

mock.module("@config", () => ({
  siteConfig: {
    name: "Mail Kit",
  },
}));

mock.module("../src/rbac/assignments.ts", () => ({
  assignUserRoleAndInvalidate: assignUserRoleAndInvalidateMock,
}));

beforeEach(() => {
  userFindUniqueMock.mockResolvedValue({
    id: "user-1",
    rbacRoles: sampleRbacRoles,
  });
  userCountMock.mockResolvedValue(2);
  userUpdateMock.mockResolvedValue({
    id: "user-1",
    name: "User One",
    email: "user@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    rbacRoles: sampleRbacRoles,
    banned: false,
    banReason: null,
    archived: false,
    onboardingComplete: false,
    plan: "free",
    subscriptionStatus: null,
  });
  invitationCreateMock.mockResolvedValue({ id: "invitation-1" });
  userFindManyMock.mockResolvedValue([]);
  userDeleteMock.mockResolvedValue({
    id: "user-1",
    name: "User One",
    email: "user@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    rbacRoles: sampleRbacRoles,
    banned: false,
    banReason: null,
    archived: false,
    onboardingComplete: false,
    plan: "free",
    subscriptionStatus: null,
  });
});

afterEach(() => {
  sessionFindManyMock.mockReset();
  userFindManyMock.mockReset();
  userCountMock.mockReset();
  userFindUniqueMock.mockReset();
  userUpdateMock.mockReset();
  userDeleteMock.mockReset();
  invitationCreateMock.mockReset();
  activityRecordMock.mockReset();
});

describe("UsersService", () => {
  it("uses a safe user projection for admin user lists", async () => {
    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await usersService.listUsers({ search: "test" });

    expect(userFindManyMock).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: "test", mode: "insensitive" } },
          { email: { contains: "test", mode: "insensitive" } },
        ],
      },
      select: safeAdminUserSelect,
      skip: 0,
      take: 10,
      orderBy: { createdAt: "desc" },
    });
  });

  it("bounds admin user list pagination", async () => {
    userCountMock.mockResolvedValue(250);
    userFindManyMock.mockResolvedValue([]);
    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    const result = await usersService.listUsers({
      page: -10,
      limit: 1_000,
    });

    expect(userFindManyMock).toHaveBeenCalledWith({
      where: {},
      select: safeAdminUserSelect,
      skip: 0,
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    expect(result.pages).toBe(3);
  });

  it("uses a safe user projection for admin user details", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: "user-1",
      rbacRoles: sampleRbacRoles,
      invitations: [],
    });

    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await usersService.getUserById("user-1");

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        ...safeAdminUserSelect,
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
  });

  it("uses a safe user projection for admin user mutations", async () => {
    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await usersService.updateUser("user-1", { name: "Updated" }, adminActor);
    await usersService.banUser("user-1", "reason", adminActor);
    await usersService.unbanUser("user-1", adminActor);
    await usersService.archiveUser("user-1", adminActor);
    await usersService.restoreUser("user-1", adminActor);
    await usersService.deleteUserPermanent("user-1", adminActor);

    expect(userUpdateMock).toHaveBeenNthCalledWith(1, {
      where: { id: "user-1" },
      data: { name: "Updated" },
      select: safeAdminUserSelect,
    });
    expect(userUpdateMock).toHaveBeenNthCalledWith(2, {
      where: { id: "user-1" },
      data: { banned: true, banReason: "reason" },
      select: safeAdminUserSelect,
    });
    expect(userUpdateMock).toHaveBeenNthCalledWith(3, {
      where: { id: "user-1" },
      data: { banned: false, banReason: null },
      select: safeAdminUserSelect,
    });
    expect(userUpdateMock).toHaveBeenNthCalledWith(4, {
      where: { id: "user-1" },
      data: { archived: true },
      select: safeAdminUserSelect,
    });
    expect(userUpdateMock).toHaveBeenNthCalledWith(5, {
      where: { id: "user-1" },
      data: { archived: false },
      select: safeAdminUserSelect,
    });
    expect(userDeleteMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: safeAdminUserSelect,
    });
  });

  it("rejects OWNER role updates from admin user management", async () => {
    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await expect(
      usersService.updateUser(
        "user-1",
        { roleSlug: Roles.PlatformOwner },
        ownerActor,
      ),
    ).rejects.toThrow("Owner role cannot be assigned from user management");
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects demoting owner accounts through user management", async () => {
    userFindUniqueMock.mockResolvedValue({
      id: "owner-user",
      rbacRoles: [
        {
          role: {
            slug: Roles.PlatformOwner,
            name: "Owner",
          },
        },
      ],
    });

    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await expect(
      usersService.updateUser(
        "owner-user",
        { roleSlug: Roles.PlatformUser },
        ownerActor,
      ),
    ).rejects.toThrow("The owner role cannot be changed");

    expect(userUpdateMock).not.toHaveBeenCalled();
    expect(assignUserRoleAndInvalidateMock).not.toHaveBeenCalled();
  });

  it("rejects OWNER invitations from admin user management", async () => {
    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await expect(
      usersService.inviteUser(
        "owner@example.com",
        Roles.PlatformOwner,
        "admin-1",
      ),
    ).rejects.toThrow("Owner role cannot be assigned from user management");
    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });

  it("does not select session tokens for admin session lists", async () => {
    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await usersService.getUserSessions("user-1");

    expect(sessionFindManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: {
        id: true,
        expiresAt: true,
        createdAt: true,
        ipAddress: true,
        userAgent: true,
      },
      orderBy: { createdAt: "desc" },
    });
  });

  it("records role changes with safe metadata", async () => {
    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await usersService.updateUser(
      "user-1",
      { roleSlug: Roles.PlatformAdmin },
      ownerActor,
    );

    expect(assignUserRoleAndInvalidateMock).toHaveBeenCalledWith(
      "user-1",
      Roles.PlatformAdmin,
    );
    expect(activityRecordMock).toHaveBeenCalledWith({
      type: "user.role_updated",
      actorUserId: "owner-1",
      targetUserId: "user-1",
      message: "User One role changed to Admin",
      metadata: {
        roleSlug: Roles.PlatformAdmin,
        email: "user@example.com",
      },
    });
  });

  it("records user invitations after invite email succeeds", async () => {
    userFindUniqueMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "admin-1", name: "Admin User" });

    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await usersService.inviteUser(
      "new@example.com",
      Roles.PlatformUser,
      "admin-1",
    );

    expect(activityRecordMock).toHaveBeenCalledWith({
      type: "user.invited",
      actorUserId: "admin-1",
      message: "new@example.com was invited as User",
      metadata: {
        email: "new@example.com",
        roleSlug: Roles.PlatformUser,
        invitationId: "invitation-1",
      },
    });
  });

  it("records ban and unban events", async () => {
    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await usersService.banUser("user-1", "spam", adminActor);
    await usersService.unbanUser("user-1", adminActor);

    expect(activityRecordMock).toHaveBeenNthCalledWith(1, {
      type: "user.banned",
      actorUserId: "admin-1",
      targetUserId: "user-1",
      severity: "warning",
      message: "User One was banned",
      metadata: {
        email: "user@example.com",
        reason: "spam",
      },
    });
    expect(activityRecordMock).toHaveBeenNthCalledWith(2, {
      type: "user.unbanned",
      actorUserId: "admin-1",
      targetUserId: "user-1",
      message: "User One was unbanned",
      metadata: {
        email: "user@example.com",
      },
    });
  });

  it("requires owner role to grant admin role", async () => {
    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await expect(
      usersService.updateUser(
        "user-1",
        { roleSlug: Roles.PlatformAdmin },
        adminActor,
      ),
    ).rejects.toThrow("Only owners can grant admin role");
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("prevents admins from changing owner accounts", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: "owner-1",
      rbacRoles: [
        { role: { slug: Roles.PlatformOwner, name: "Owner" } },
      ],
    });

    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await expect(
      usersService.updateUser("owner-1", { name: "Updated Owner" }, adminActor),
    ).rejects.toThrow("Only owners can access owner accounts");
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("prevents admins from destructive actions against admin accounts", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: "admin-2",
      rbacRoles: [
        { role: { slug: Roles.PlatformAdmin, name: "Admin" } },
      ],
    });

    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await expect(
      usersService.banUser("admin-2", "reason", adminActor),
    ).rejects.toThrow("Only owners can change admin or owner accounts");
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("prevents self ban archive and delete", async () => {
    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await expect(
      usersService.banUser("admin-1", "reason", adminActor),
    ).rejects.toThrow("You cannot ban your own account");
    await expect(
      usersService.archiveUser("admin-1", adminActor),
    ).rejects.toThrow("You cannot archive your own account");
    await expect(
      usersService.deleteUserPermanent("admin-1", adminActor),
    ).rejects.toThrow("You cannot delete your own account");
    expect(userUpdateMock).not.toHaveBeenCalled();
    expect(userDeleteMock).not.toHaveBeenCalled();
  });

  it("prevents disabling or deleting owner accounts", async () => {
    userFindUniqueMock.mockResolvedValue({
      id: "owner-2",
      rbacRoles: [
        { role: { slug: Roles.PlatformOwner, name: "Owner" } },
      ],
    });
    countActivePlatformOwnersMock.mockResolvedValue(2);

    const { usersService } = await import(
      "../src/modules/admin/users/users.service"
    );

    await expect(
      usersService.banUser("owner-2", "reason", ownerActor),
    ).rejects.toThrow("Owner accounts cannot be banned, archived, or deleted");
    await expect(
      usersService.archiveUser("owner-2", ownerActor),
    ).rejects.toThrow("Owner accounts cannot be banned, archived, or deleted");
    await expect(
      usersService.deleteUserPermanent("owner-2", ownerActor),
    ).rejects.toThrow("Owner accounts cannot be banned, archived, or deleted");
    expect(userUpdateMock).not.toHaveBeenCalled();
    expect(userDeleteMock).not.toHaveBeenCalled();
  });
});
