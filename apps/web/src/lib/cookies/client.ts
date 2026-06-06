import Cookies from "universal-cookie";

import type { CookieGetOptions, CookieSetOptions } from "universal-cookie";

const DEFAULT_SET_OPTIONS: CookieSetOptions = { path: "/" };

let store: Cookies | undefined;

function getStore(): Cookies {
  store ??= new Cookies(undefined, DEFAULT_SET_OPTIONS);
  return store;
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
  getStore().set(name, value, options);
}

export function removeCookie(name: string, options?: CookieSetOptions): void {
  getStore().remove(name, options);
}

export function getAllCookies<
  T extends Record<string, unknown> = Record<string, unknown>,
>(options?: CookieGetOptions): T {
  return getStore().getAll(options) as T;
}

export function createCookies(defaultSetOptions?: CookieSetOptions): Cookies {
  return new Cookies(undefined, { ...DEFAULT_SET_OPTIONS, ...defaultSetOptions });
}
