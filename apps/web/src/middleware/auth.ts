import { createMiddleware } from "@tanstack/react-start";

import { resolveSession } from "@/features/user/lib/resolve-session";

export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const session = await resolveSession(request.headers);

  if (!session) {
    throw new Error("Unauthorized");
  }

  return next({
    context: { session },
  });
});
