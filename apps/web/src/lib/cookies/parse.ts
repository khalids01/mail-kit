import Cookies from "universal-cookie";

import type { CookieGetOptions } from "universal-cookie";

export type { CookieGetOptions, CookieSetOptions } from "universal-cookie";

export function parseCookies(
  cookieHeader: string | Record<string, string> | null | undefined,
  options?: CookieGetOptions,
): Record<string, unknown> {
  return new Cookies(cookieHeader ?? undefined).getAll(options);
}
