import { afterEach, describe, expect, it, mock } from "bun:test";
import { Prisma } from "../../../packages/db/prisma/generated/client";

type Identity = {
  id: string;
  visitorId: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  firstUserId: string | null;
  lastUserId: string | null;
};

type Session = {
  id: string;
  visitorIdentityId: string;
  userId: string | null;
  isBot: boolean;
  startedAt: Date;
  lastSeenAt: Date;
  endedAt: Date;
  entryPath: string;
  lastPath: string;
  referrer: string | null;
  deviceType: string | null;
  country: string | null;
  ipHash: string | null;
  eventCount: number;
};

let identityStore: Identity[] = [];
let sessionStore: Session[] = [];

const dbMock = {
  visitorIdentity: {
    findFirst: mock(async ({ where }: any) => {
      const userIds = (where.OR ?? [])
        .flatMap((item: any) => [item.firstUserId, item.lastUserId])
        .filter(Boolean);

      return (
        identityStore
          .filter(
            (item) =>
              userIds.includes(item.firstUserId) ||
              userIds.includes(item.lastUserId),
          )
          .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())[0] ??
        null
      );
    }),
    findUnique: mock(async ({ where: { visitorId } }: any) => {
      return identityStore.find((item) => item.visitorId === visitorId) ?? null;
    }),
    create: mock(async ({ data }: any) => {
      const created: Identity = {
        id: `identity-${identityStore.length + 1}`,
        visitorId: data.visitorId,
        firstSeenAt: data.firstSeenAt,
        lastSeenAt: data.lastSeenAt,
        firstUserId: data.firstUserId ?? null,
        lastUserId: data.lastUserId ?? null,
      };
      identityStore.push(created);
      return created;
    }),
    update: mock(async ({ where: { id }, data }: any) => {
      const index = identityStore.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("identity not found");

      const current = identityStore[index]!;
      const next = {
        ...current,
        ...data,
      };
      identityStore[index] = next;
      return next;
    }),
    deleteMany: mock(async () => ({ count: 0 })),
  },
  visitorSession: {
    findFirst: mock(async ({ where }: any) => {
      const gte = where.lastSeenAt.gte as Date;
      const candidates = sessionStore
        .filter(
          (item) =>
            item.visitorIdentityId === where.visitorIdentityId &&
            item.isBot === where.isBot &&
            item.lastSeenAt >= gte,
        )
        .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());

      return candidates[0] ?? null;
    }),
    create: mock(async ({ data }: any) => {
      const created: Session = {
        id: `session-${sessionStore.length + 1}`,
        visitorIdentityId: data.visitorIdentityId,
        userId: data.userId ?? null,
        isBot: data.isBot,
        startedAt: data.startedAt,
        lastSeenAt: data.lastSeenAt,
        endedAt: data.endedAt,
        entryPath: data.entryPath,
        lastPath: data.lastPath,
        referrer: data.referrer ?? null,
        deviceType: data.deviceType ?? null,
        country: data.country ?? null,
        ipHash: data.ipHash ?? null,
        eventCount: data.eventCount,
      };
      sessionStore.push(created);
      return created;
    }),
    update: mock(async ({ where: { id }, data }: any) => {
      const index = sessionStore.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("session not found");

      const current = sessionStore[index]!;
      const next = {
        ...current,
        ...data,
        eventCount:
          data.eventCount?.increment !== undefined
            ? current.eventCount + data.eventCount.increment
            : current.eventCount,
      };
      sessionStore[index] = next;
      return next;
    }),
  },
  $queryRaw: mock(async () => []),
};

const sessionMock = mock(async (): Promise<{ user: { id: string } } | null> => ({
  user: {
    id: "user-1",
  },
}));

const redisState = {
  values: new Map<string, number | string>(),
  expiry: new Map<string, number>(),
  sets: new Map<string, Set<string>>(),
};

const fakeRedis = {
  async incr(key: string) {
    const current = Number(redisState.values.get(key) ?? 0);
    const nextValue = current + 1;
    redisState.values.set(key, nextValue);
    return nextValue;
  },
  async expire(key: string, seconds: number) {
    redisState.expiry.set(key, Date.now() + seconds * 1000);
    return 1;
  },
  async get(key: string) {
    const value = redisState.values.get(key);
    return value === undefined ? null : String(value);
  },
  async set(key: string, value: string) {
    redisState.values.set(key, value);
    return "OK";
  },
  async sadd(key: string, value: string) {
    const values = redisState.sets.get(key) ?? new Set<string>();
    const sizeBefore = values.size;
    values.add(value);
    redisState.sets.set(key, values);
    return values.size - sizeBefore;
  },
  async smembers(key: string) {
    return Array.from(redisState.sets.get(key) ?? []);
  },
  async srem(key: string, value: string) {
    const values = redisState.sets.get(key);
    if (!values) return 0;
    const removed = values.delete(value);
    return removed ? 1 : 0;
  },
  async rename(from: string, to: string) {
    if (!redisState.values.has(from)) {
      throw new Error("no such key");
    }

    redisState.values.set(to, redisState.values.get(from)!);
    redisState.values.delete(from);
    return "OK";
  },
  async del(key: string) {
    const existed = redisState.values.delete(key);
    redisState.sets.delete(key);
    return existed ? 1 : 0;
  },
  async exists(key: string) {
    return redisState.values.has(key) ? 1 : 0;
  },
};

const connectRedisMock = mock(async () => fakeRedis);

mock.module("@db/server", () => ({
  default: dbMock,
  Prisma,
}));

mock.module("@redis/server", () => ({
  connectRedis: connectRedisMock,
  getCache: mock(async () => null),
  setCache: mock(async () => undefined),
  deleteCache: mock(async () => undefined),
  getRedis: () => ({ status: "ready" }),
}));

mock.module("@/modules/auth/auth.service", () => ({
  auth: {
    api: {
      getSession: sessionMock,
    },
  },
}));

function restoreDbImplementations() {
  dbMock.visitorIdentity.findFirst.mockImplementation(async ({ where }: any) => {
    const userIds = (where.OR ?? [])
      .flatMap((item: any) => [item.firstUserId, item.lastUserId])
      .filter(Boolean);

    return (
      identityStore
        .filter(
          (item) =>
            userIds.includes(item.firstUserId) ||
            userIds.includes(item.lastUserId),
        )
        .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())[0] ??
      null
    );
  });

  dbMock.visitorIdentity.findUnique.mockImplementation(
    async ({ where: { visitorId } }: any) => {
      return identityStore.find((item) => item.visitorId === visitorId) ?? null;
    },
  );

  dbMock.visitorIdentity.create.mockImplementation(async ({ data }: any) => {
    const created: Identity = {
      id: `identity-${identityStore.length + 1}`,
      visitorId: data.visitorId,
      firstSeenAt: data.firstSeenAt,
      lastSeenAt: data.lastSeenAt,
      firstUserId: data.firstUserId ?? null,
      lastUserId: data.lastUserId ?? null,
    };
    identityStore.push(created);
    return created;
  });

  dbMock.visitorIdentity.update.mockImplementation(
    async ({ where: { id }, data }: any) => {
      const index = identityStore.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("identity not found");

      const current = identityStore[index]!;
      const next = {
        ...current,
        ...data,
      };
      identityStore[index] = next;
      return next;
    },
  );

  dbMock.visitorIdentity.deleteMany.mockImplementation(async () => ({ count: 0 }));

  dbMock.visitorSession.findFirst.mockImplementation(async ({ where }: any) => {
    const gte = where.lastSeenAt.gte as Date;
    const candidates = sessionStore
      .filter(
        (item) =>
          item.visitorIdentityId === where.visitorIdentityId &&
          item.isBot === where.isBot &&
          item.lastSeenAt >= gte,
      )
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());

    return candidates[0] ?? null;
  });

  dbMock.visitorSession.create.mockImplementation(async ({ data }: any) => {
    const created: Session = {
      id: `session-${sessionStore.length + 1}`,
      visitorIdentityId: data.visitorIdentityId,
      userId: data.userId ?? null,
      isBot: data.isBot,
      startedAt: data.startedAt,
      lastSeenAt: data.lastSeenAt,
      endedAt: data.endedAt,
      entryPath: data.entryPath,
      lastPath: data.lastPath,
      referrer: data.referrer ?? null,
      deviceType: data.deviceType ?? null,
      country: data.country ?? null,
      ipHash: data.ipHash ?? null,
      eventCount: data.eventCount,
    };
    sessionStore.push(created);
    return created;
  });

  dbMock.visitorSession.update.mockImplementation(
    async ({ where: { id }, data }: any) => {
      const index = sessionStore.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("session not found");

      const current = sessionStore[index]!;
      const next = {
        ...current,
        ...data,
        eventCount:
          data.eventCount?.increment !== undefined
            ? current.eventCount + data.eventCount.increment
            : current.eventCount,
      };
      sessionStore[index] = next;
      return next;
    },
  );
}

afterEach(() => {
  identityStore = [];
  sessionStore = [];

  dbMock.visitorIdentity.findUnique.mockReset();
  dbMock.visitorIdentity.findFirst.mockReset();
  dbMock.visitorIdentity.create.mockReset();
  dbMock.visitorIdentity.update.mockReset();
  dbMock.visitorIdentity.deleteMany.mockReset();
  dbMock.visitorSession.findFirst.mockReset();
  dbMock.visitorSession.create.mockReset();
  dbMock.visitorSession.update.mockReset();
  dbMock.$queryRaw.mockReset();
  sessionMock.mockReset();
  sessionMock.mockResolvedValue({ user: { id: "user-1" } });
  connectRedisMock.mockReset();
  connectRedisMock.mockResolvedValue(fakeRedis);
  redisState.values.clear();
  redisState.expiry.clear();
  redisState.sets.clear();
  restoreDbImplementations();
});

describe("VisitorsService.trackVisit", () => {
  it("buffers active session events and flushes one aggregate write", async () => {
    const { visitorsService } = await import(
      "../src/modules/visitors/visitors.service"
    );

    const setCookieMock = mock((_value: string) => undefined);

    const request = new Request("http://localhost:5005/analytics/visitors/track", {
      headers: {
        cookie: "visitor_id=visitor-abc-1234567890",
        "user-agent": "Mozilla/5.0",
      },
    });

    await visitorsService.trackVisit({
      request,
      body: {
        path: "/pricing",
        activityType: "pageview",
      },
      setCookie: setCookieMock,
    });

    await visitorsService.trackVisit({
      request,
      body: {
        path: "/dashboard",
        activityType: "activity",
      },
      setCookie: setCookieMock,
    });

    expect(dbMock.visitorIdentity.create).not.toHaveBeenCalled();
    expect(dbMock.visitorSession.create).not.toHaveBeenCalled();
    expect(dbMock.visitorSession.update).not.toHaveBeenCalled();

    await visitorsService.flushBufferedVisits();

    expect(dbMock.visitorIdentity.create).toHaveBeenCalledTimes(1);
    expect(dbMock.visitorSession.create).toHaveBeenCalledTimes(1);
    expect(dbMock.visitorSession.update).not.toHaveBeenCalled();
    expect(sessionStore[0]?.lastPath).toBe("/dashboard");
    expect(sessionStore[0]?.eventCount).toBe(2);
  });

  it("marks bot user-agents as bot sessions", async () => {
    const { visitorsService } = await import(
      "../src/modules/visitors/visitors.service"
    );

    const setCookieMock = mock((_value: string) => undefined);

    const request = new Request("http://localhost:5005/analytics/visitors/track", {
      headers: {
        cookie: "visitor_id=visitor-bot-1234567890",
        "user-agent": "Googlebot/2.1",
      },
    });

    await visitorsService.trackVisit({
      request,
      body: {
        path: "/",
        activityType: "pageview",
      },
      setCookie: setCookieMock,
    });

    await visitorsService.flushBufferedVisits();

    expect(dbMock.visitorSession.create).toHaveBeenCalledTimes(1);
    expect(sessionStore[0]?.isBot).toBe(true);
  });

  it("reuses one visitor identity for the same logged-in user across changed cookies", async () => {
    const { visitorsService } = await import(
      "../src/modules/visitors/visitors.service"
    );

    const setCookieMock = mock((_value: string) => undefined);
    const cookies = [
      "visitor_id=visitor-one-1234567890",
      "visitor_id=visitor-two-1234567890",
      "visitor_id=visitor-three-1234567890",
    ];

    for (const cookie of cookies) {
      await visitorsService.trackVisit({
        request: new Request(
          "http://localhost:5005/analytics/visitors/track",
          {
            headers: {
              cookie,
              "user-agent": "Mozilla/5.0",
            },
          },
        ),
        body: {
          path: "/",
          activityType: "pageview",
        },
        setCookie: setCookieMock,
      });
    }

    expect(identityStore).toHaveLength(0);

    await visitorsService.flushBufferedVisits();

    expect(identityStore).toHaveLength(1);
    expect(dbMock.visitorIdentity.create).toHaveBeenCalledTimes(1);
    expect(sessionStore.every((item) => item.visitorIdentityId === "identity-1")).toBe(
      true,
    );
    expect(setCookieMock).toHaveBeenCalledWith(
      expect.stringContaining("visitor_id=visitor-one-1234567890"),
    );
  });

  it("keeps anonymous visitors with different cookies separate", async () => {
    sessionMock.mockResolvedValue(null);
    const { visitorsService } = await import(
      "../src/modules/visitors/visitors.service"
    );

    const setCookieMock = mock((_value: string) => undefined);

    for (const cookie of [
      "visitor_id=anon-one-1234567890",
      "visitor_id=anon-two-1234567890",
    ]) {
      await visitorsService.trackVisit({
        request: new Request(
          "http://localhost:5005/analytics/visitors/track",
          {
            headers: {
              cookie,
              "user-agent": "Mozilla/5.0",
            },
          },
        ),
        body: {
          path: "/",
          activityType: "pageview",
        },
        setCookie: setCookieMock,
      });
    }

    await visitorsService.flushBufferedVisits();

    expect(identityStore).toHaveLength(2);
    expect(dbMock.visitorIdentity.create).toHaveBeenCalledTimes(2);
  });

  it("ignores internal paths even when posted directly to the tracking endpoint", async () => {
    const { visitorsService } = await import(
      "../src/modules/visitors/visitors.service"
    );

    const result = await visitorsService.trackVisit({
      request: new Request("http://localhost:5005/analytics/visitors/track", {
        headers: {
          cookie: "visitor_id=visitor-admin-1234567890",
          "user-agent": "Mozilla/5.0",
        },
      }),
      body: {
        path: "/admin/visitors",
        activityType: "pageview",
      },
      setCookie: mock((_value: string) => undefined),
    });

    expect(result).toMatchObject({
      ok: true,
      ignored: true,
    });
    expect(sessionMock).not.toHaveBeenCalled();
    expect(dbMock.visitorIdentity.create).not.toHaveBeenCalled();
    expect(dbMock.visitorSession.create).not.toHaveBeenCalled();
  });

  it("sets secure cookie attributes for cross-site tracking cookies", async () => {
    const { visitorsService } = await import(
      "../src/modules/visitors/visitors.service"
    );

    const setCookieMock = mock((_value: string) => undefined);

    await visitorsService.trackVisit({
      request: new Request("https://api.example.com/analytics/visitors/track", {
        headers: {
          origin: "https://app.example.net",
          "user-agent": "Mozilla/5.0",
        },
      }),
      body: {
        path: "/",
        activityType: "pageview",
      },
      setCookie: setCookieMock,
    });

    const cookieHeader = setCookieMock.mock.calls[0]?.[0] ?? "";
    expect(cookieHeader).toContain("visitor_id=");
    expect(cookieHeader).toContain("HttpOnly");
    expect(cookieHeader).toContain("SameSite=None");
    expect(cookieHeader).toContain("Secure");
  });
});
