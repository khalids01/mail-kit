import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import Loader from "./components/loader";
import "./index.css";
import { routeTree } from "./routeTree.gen";
import type { RouterAppContext } from "./routes/__root";

export const getRouter = () => {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    context: {
      session: null,
    } satisfies RouterAppContext,
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    Wrap: ({ children }) => <>{children}</>,
  });
  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
