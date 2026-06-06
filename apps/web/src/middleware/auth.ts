import { createMiddleware } from "@tanstack/react-start";

import { getRootSession } from "@/features/user/lib/get-root-session";

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await getRootSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  return next({
    context: { session },
  });
});
