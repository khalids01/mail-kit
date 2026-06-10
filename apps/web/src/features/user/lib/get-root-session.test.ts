import { afterEach, describe, expect, it, mock } from "bun:test";
import { getRootSessionForHeaders } from "./get-root-session";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("getRootSessionForHeaders", () => {
  it("dedupes concurrent session context requests for the same credentials", async () => {
    let calls = 0;

    globalThis.fetch = mock(async () => {
      calls += 1;
      await Promise.resolve();

      return new Response(
        JSON.stringify({
          user: null,
          permissions: [],
          roles: [],
          primaryRoleSlug: null,
          primaryRoleId: null,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const headers = new Headers({ cookie: "session=token" });
    const [first, second] = await Promise.all([
      getRootSessionForHeaders(headers),
      getRootSessionForHeaders(headers),
    ]);

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(calls).toBe(1);
  });
});
