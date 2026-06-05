import { deleteCache, getCache, setCache } from "../../../../redis/src/index.server";
import type { UserSessionRbacPayload } from "@rbac";
import {
  EFFECTIVE_PERMISSIONS_TTL_SECONDS,
  effectivePermissionsKey,
} from "../keys";

export async function getCachedUserSessionRbac(userId: string) {
  return getCache<UserSessionRbacPayload>(effectivePermissionsKey(userId));
}

/** @deprecated Use getCachedUserSessionRbac */
export const getCachedEffectivePermissions = getCachedUserSessionRbac;

export async function setCachedUserSessionRbac(
  userId: string,
  payload: UserSessionRbacPayload,
) {
  await setCache(
    effectivePermissionsKey(userId),
    payload,
    EFFECTIVE_PERMISSIONS_TTL_SECONDS,
  );
}

/** @deprecated Use setCachedUserSessionRbac */
export const setCachedEffectivePermissions = setCachedUserSessionRbac;

export async function deleteCachedUserSessionRbac(userId: string) {
  await deleteCache(effectivePermissionsKey(userId));
}

/** @deprecated Use deleteCachedUserSessionRbac */
export const deleteCachedEffectivePermissions = deleteCachedUserSessionRbac;
