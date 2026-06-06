import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import type { ClientSessionResult } from "@auth/client";

import { resolveSession } from "@/features/user/lib/resolve-session";

export const getRootSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<ClientSessionResult> => {
    return resolveSession(getRequestHeaders());
  },
);
