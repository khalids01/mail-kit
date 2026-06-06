import {
  toClientSession,
  type AuthClientSession,
  type ClientSessionResult,
} from "@auth/client";
import { getRequestHeader } from "@tanstack/react-start/server";

import { authClient } from "@/lib/auth-client";
import { createCookies, getCookie } from "@/lib/cookies/server";
import { env } from "@env/client";

async function resolveSessionForCookieHeader(
  cookieHeader: string | null,
): Promise<ClientSessionResult> {
  const authSessionCookie = cookieHeader
    ? createCookies(cookieHeader).get(env.AUTH_SESSION_COOKIE_NAME)
    : getCookie(env.AUTH_SESSION_COOKIE_NAME);

  if (!authSessionCookie) {
    console.log("[resolveSession] missing auth session cookie");
    return null;
  }

  const headers = new Headers();
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  } else {
    headers.set(
      "cookie",
      `${env.AUTH_SESSION_COOKIE_NAME}=${String(authSessionCookie)}`,
    );
  }

  try {
    const { data } = await authClient.getSession({
      fetchOptions: {
        headers,
        credentials: "include",
      },
    });

    return toClientSession(data as AuthClientSession | null);
  } catch (error) {
    console.error("[resolveSession] authClient.getSession failed", error);
    return null;
  }
}

export async function resolveSession(headers: Headers): Promise<ClientSessionResult> {
  const cookieHeader = headers.get("cookie") ?? getRequestHeader("cookie") ?? null;

  console.log("[resolveSession] cookie header exists:", Boolean(cookieHeader));
  console.log("[resolveSession] cookie header:", cookieHeader);
  console.log("[resolveSession] expected cookie:", env.AUTH_SESSION_COOKIE_NAME);

  return resolveSessionForCookieHeader(cookieHeader);
}
