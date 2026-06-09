import { describe, expect, it } from "bun:test";
import { Permissions, RolePermissionMap, Roles } from "@rbac";
import {
  assertActorCanAccessOwnerTarget,
  assertActorCanChangePrivilegedAccounts,
  assertActorCanGrantAdminRole,
  assertNotSelfTarget,
  assertOwnerAccountCannotBeDisabled,
  assertOwnerRoleIsImmutable,
  filterOwnerUsers,
} from "../../src/rbac/policies/owner.policy";

const ownerPermissions = new Set(RolePermissionMap[Roles.PlatformOwner]);
const adminPermissions = new Set(RolePermissionMap[Roles.PlatformAdmin]);

describe("owner policy", () => {
  it("blocks admin from targeting owner accounts", () => {
    expect(() =>
      assertActorCanAccessOwnerTarget({
        actorPermissions: adminPermissions,
        targetRoleSlug: Roles.PlatformOwner,
      }),
    ).toThrow("Only owners can access owner accounts");
  });

  it("allows owner to target owner accounts", () => {
    expect(() =>
      assertActorCanAccessOwnerTarget({
        actorPermissions: ownerPermissions,
        targetRoleSlug: Roles.PlatformOwner,
      }),
    ).not.toThrow();
  });

  it("blocks admin from granting admin role", () => {
    expect(() =>
      assertActorCanGrantAdminRole({
        actorPermissions: adminPermissions,
        nextRoleSlug: Roles.PlatformAdmin,
      }),
    ).toThrow("Only owners can grant admin role");
  });

  it("blocks self destructive actions", () => {
    expect(() =>
      assertNotSelfTarget({
        actorId: "user-1",
        targetId: "user-1",
        action: "ban",
      }),
    ).toThrow("You cannot ban your own account");
  });

  it("filters owner users from admin list views", () => {
    const users = [
      { id: "1", role: { slug: Roles.PlatformUser, name: "User" } },
      { id: "2", role: { slug: Roles.PlatformOwner, name: "Owner" } },
    ];

    const filtered = filterOwnerUsers(users, adminPermissions);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.role.slug).toBe(Roles.PlatformUser);
  });

  it("blocks admin from changing privileged accounts", () => {
    expect(() =>
      assertActorCanChangePrivilegedAccounts({
        actorPermissions: adminPermissions,
        targetRoleSlug: Roles.PlatformAdmin,
      }),
    ).toThrow("Only owners can change admin or owner accounts");
  });

  it("owner permissions include grant_admin capability", () => {
    expect(ownerPermissions.has(Permissions.AdminUsersGrantAdmin)).toBe(true);
  });

  it("blocks changing owner role to another role", () => {
    expect(() =>
      assertOwnerRoleIsImmutable({
        targetRoleSlug: Roles.PlatformOwner,
        nextRoleSlug: Roles.PlatformUser,
      }),
    ).toThrow("The owner role cannot be changed");

    expect(() =>
      assertOwnerRoleIsImmutable({
        targetRoleSlug: Roles.PlatformOwner,
        nextRoleSlug: Roles.PlatformOwner,
      }),
    ).not.toThrow();

    expect(() =>
      assertOwnerRoleIsImmutable({
        targetRoleSlug: Roles.PlatformUser,
        nextRoleSlug: Roles.PlatformAdmin,
      }),
    ).not.toThrow();
  });

  it("blocks disabling owner accounts", () => {
    expect(() =>
      assertOwnerAccountCannotBeDisabled({
        targetRoleSlug: Roles.PlatformOwner,
      }),
    ).toThrow("Owner accounts cannot be banned, archived, or deleted");

    expect(() =>
      assertOwnerAccountCannotBeDisabled({
        targetRoleSlug: Roles.PlatformAdmin,
      }),
    ).not.toThrow();

    expect(() =>
      assertOwnerAccountCannotBeDisabled({
        targetRoleSlug: Roles.PlatformUser,
      }),
    ).not.toThrow();
  });
});
