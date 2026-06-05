import { connectRedis } from "../../../../redis/src/index.server";
import type { UserSessionRbacPayload } from "@rbac";
import { deleteCachedUserSessionRbac } from "./effective.server";
import { RBAC_CATALOG_VERSION_KEY } from "../keys";

export async function invalidateUser(userId: string) {
  await deleteCachedUserSessionRbac(userId);
}

export async function getCatalogVersion(): Promise<number> {
  const redis = await connectRedis();
  const value = await redis.get(RBAC_CATALOG_VERSION_KEY);
  return value ? Number.parseInt(value, 10) : 0;
}

export async function bumpCatalogVersion() {
  const redis = await connectRedis();
  const current = await getCatalogVersion();
  await redis.set(RBAC_CATALOG_VERSION_KEY, String(current + 1));
}

export async function invalidateAllEffective() {
  const redis = await connectRedis();
  const prefix = redis.options.keyPrefix ?? "";
  const pattern = `${prefix}rbac:effective:*`;
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    cursor = nextCursor;

    if (keys.length > 0) {
      const stripped = keys.map((key) =>
        key.startsWith(prefix) ? key.slice(prefix.length) : key,
      );
      await redis.del(...stripped);
    }
  } while (cursor !== "0");
}

export async function invalidateRole(_roleId: string, userIds: string[]) {
  await bumpCatalogVersion();

  for (const userId of userIds) {
    await invalidateUser(userId);
  }
}

export function isUserSessionRbacPayloadComplete(
  payload: UserSessionRbacPayload | null | undefined,
): payload is UserSessionRbacPayload {
  return (
    payload != null &&
    Array.isArray(payload.permissions) &&
    Array.isArray(payload.roles) &&
    typeof payload.primaryRoleSlug === "string"
  );
}

export async function isEffectiveCacheStale(
  payload: { catalogVersion: number },
) {
  const currentVersion = await getCatalogVersion();
  return payload.catalogVersion !== currentVersion;
}

export async function isUserSessionRbacCacheValid(
  payload: UserSessionRbacPayload | null | undefined,
) {
  if (!isUserSessionRbacPayloadComplete(payload)) {
    return false;
  }

  return !(await isEffectiveCacheStale(payload));
}
