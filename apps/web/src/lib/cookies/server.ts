import Cookies from "universal-cookie";
import {
  deleteCookie as deleteResponseCookie,
  getRequestHeader,
  setCookie as setResponseCookie,
} from "@tanstack/react-start/server";

import type { CookieGetOptions, CookieSetOptions } from "universal-cookie";

function getStore(cookieHeader?: string | null): Cookies {
  return new Cookies(
    cookieHeader ?? getRequestHeader("cookie") ?? undefined,
  );
}

function serializeValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function toSerializeOptions(
  options?: CookieSetOptions,
): CookieSetOptions | undefined {
  if (!options) {
    return undefined;
  }

  const { sameSite, ...rest } = options;

  return {
    ...rest,
    ...(sameSite !== undefined && {
      sameSite:
        typeof sameSite === "boolean"
          ? sameSite
            ? "strict"
            : "lax"
          : sameSite,
    }),
  };
}

export function getCookie<T = unknown>(
  name: string,
  options?: CookieGetOptions,
): T | undefined {
  const value = getStore().get<T>(name, options);
  return value === undefined ? undefined : value;
}

export function setCookie(
  name: string,
  value: unknown,
  options?: CookieSetOptions,
): void {
  setResponseCookie(
    name,
    serializeValue(value),
    toSerializeOptions(options),
  );
}

export function removeCookie(name: string, options?: CookieSetOptions): void {
  deleteResponseCookie(name, toSerializeOptions(options));
}

export function getAllCookies<
  T extends Record<string, unknown> = Record<string, unknown>,
>(options?: CookieGetOptions): T {
  return getStore().getAll(options) as T;
}

export function createCookies(cookieHeader?: string | null): Cookies {
  return getStore(cookieHeader);
}

export { parseCookies } from "./parse";
