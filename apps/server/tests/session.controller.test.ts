import { describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { Permissions, Roles } from "@rbac";

const getAuthSessionMock = mock(async () => ({
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    banned: false,
    archived: false,
    onboardingComplete: true,
    plan: null,
    subscriptionStatus: null,
  },
  session: {
    id: "session-1",
    userId: "user-1",
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    token: "token",
  },
  permissions: [Permissions.FeedbackSubmit],
  roles: [{ id: "role-user", slug: Roles.PlatformUser, name: "User" }],
  primaryRoleSlug: Roles.PlatformUser,
  primaryRoleId: "role-user",
}));

mock.module("@auth/server", () => ({
  getAuthSession: getAuthSessionMock,
}));

describe("sessionController", () => {
  it("returns client session context with private no-store cache headers", async () => {
    const { sessionController } = await import(
      "../src/modules/session/session.controller"
    );

    const app = new Elysia().use(sessionController);
    const response = await app.handle(
      new Request("http://localhost/session/context"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      user: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        onboardingComplete: true,
        plan: null,
        subscriptionStatus: null,
      },
      permissions: [Permissions.FeedbackSubmit],
      roles: [{ id: "role-user", slug: Roles.PlatformUser, name: "User" }],
      primaryRoleSlug: Roles.PlatformUser,
      primaryRoleId: "role-user",
    });
  });
});
