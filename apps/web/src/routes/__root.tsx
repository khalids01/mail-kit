import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
// import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "@/components/ui/sonner";
import { TanstackQueryProvider } from "@/providers/tanstack-router";
import { ThemeProvider } from "@/providers/theme-provider";
import { SessionProvider } from "@/providers/session-provider";
import type { ClientSessionResult } from "@auth/client";
import { getRootSession } from "@/features/user/lib/get-root-session";
import { VisitorTracker } from "@/features/visitors/visitor-tracker";

// const isDevelopment = import.meta.env.DEV;

export interface RouterAppContext {
  session: ClientSessionResult;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Saas Starter",
      },
    ],
  }),
  beforeLoad: async () => {
    const session = await getRootSession();
    console.log("[root.beforeLoad] session", Boolean(session), session?.user?.id);
    return { session };
  },

  component: RootDocument,
});

function RootDocument() {
  const { session } = Route.useRouteContext();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SessionProvider session={session}>
            <TanstackQueryProvider>
              <Outlet />
            </TanstackQueryProvider>
          </SessionProvider>
          <VisitorTracker />
          <Toaster richColors position="top-center"/>
          {/* {isDevelopment && <TanStackRouterDevtools position="bottom-left" />} */}
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
