import { afterEach, describe, expect, it, mock } from "bun:test";
import { Prisma } from "../../../packages/db/prisma/generated/client";

const findUniqueMock = mock(async () => null);
const authApi =
  ((globalThis as typeof globalThis & {
    __serverTestAuthApi?: {
      getSession: ReturnType<typeof mock>;
      signInMagicLink: ReturnType<typeof mock>;
    };
  }).__serverTestAuthApi ??= {
    getSession: mock(async () => null),
    signInMagicLink: mock(async () => ({ success: true })),
  });

mock.module("@db/server", () => ({
  default: {
    user: {
      findUnique: findUniqueMock,
    },
  },
  Prisma,
}));

mock.module("@auth/server", () => ({
  auth: {
    api: authApi,
  },
  getAuthSession: mock(async () => null),
}));

mock.module("@env/server", () => ({
  env: {
    CORS_ORIGIN: "http://localhost:5006",
  },
}));

afterEach(() => {
  findUniqueMock.mockReset();
  authApi.signInMagicLink.mockReset();
});

describe("authController", () => {
  it("returns 400 when magic-link login is requested for an unknown user", async () => {
    findUniqueMock.mockResolvedValue(null);

    const { authController } = await import("../src/modules/auth/auth.controller");

    const response = await authController.handle(
      new Request("http://localhost/auth/magic-link/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "missing@example.com",
        }),
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ message: "User not found" });
    expect(authApi.signInMagicLink).not.toHaveBeenCalled();
  });
});
