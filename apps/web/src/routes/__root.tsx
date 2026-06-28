import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { TanstackQueryProvider } from "@/providers/tanstack-query";
import { ThemeProvider } from "@/providers/theme-provider";
import { getRootSession } from "@/features/user/lib/get-root-session";
import { VisitorTracker } from "@/features/visitors/visitor-tracker";
import type { ClientSessionResult } from "@auth/client";


export interface RouterAppContext {
  session?: ClientSessionResult;
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
        title: "Mail Kit",
      },
    ],
  }),
  loader: async () => {
    const session = await getRootSession();
    return { session: session ?? null };
  },
  staleTime: Infinity,
  gcTime: Infinity,
  shouldReload: false,

  component: RootDocument,
});

function RootDocument() {


  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TanstackQueryProvider>
            <Outlet />
          </TanstackQueryProvider>
          <VisitorTracker />
          <Toaster richColors position="top-center"/>
          {/* {isDevelopment && <TanStackRouterDevtools position="bottom-left" />} */}
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
