import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import {
  toClientSession,
  type AuthClientSession,
  type ClientSessionResult,
} from "@auth/client";
import { authClient } from "@/lib/auth-client";

export const getRootSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<ClientSessionResult> => {
    const headers = getRequestHeaders();

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
  },
);
