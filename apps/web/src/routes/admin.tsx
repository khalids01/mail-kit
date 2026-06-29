import {
  createFileRoute,
  Outlet,
  Link,
  useLocation,
} from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  ChevronRight,
  MessageSquare,
  ShieldAlert,
  Activity,
  History,
  Webhook,
  Shield,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import UserMenu from "@/components/core/user-menu";
import { ThemeToggle } from "@/components/core/theme-toggle";
import { NotificationBell } from "@/components/core/notification-bell";
import BrandMark from "@/components/core/logo";
import {
  canShowActivityNav,
  canShowFeedbackNav,
  canShowMailNav,
  canShowRateLimitsNav,
  canShowRolesNav,
  canShowUsersNav,
  canShowVisitorsNav,
  canShowWebhooksNav,
} from "@/features/admin/lib/admin-access";
import { adminMiddleware } from "@/middleware/admin";
import { useSession } from "@/providers/session-provider";
import type { ClientSession } from "@auth/client";

export const Route = createFileRoute("/admin")({
  server: {
    middleware: [adminMiddleware],
  },
  beforeLoad: async ({ context, cause }) => {
    if (cause === "stay") {
      return;
    }

    return {
      session: context.session,
    };
  },
  component: AdminLayout,
});

type AdminNavItem = {
  title: string;
  icon: LucideIcon;
  url: string;
  show: boolean;
};

function getAdminNavItems(session: ClientSession | null | undefined): AdminNavItem[] {
  return [
    {
      title: "Overview",
      icon: LayoutDashboard,
      url: "/admin/overview",
      show: true,
    },
    {
      title: "Users",
      icon: Users,
      url: "/admin/users",
      show: canShowUsersNav(session),
    },
    {
      title: "Roles",
      icon: Shield,
      url: "/admin/roles",
      show: canShowRolesNav(session),
    },
    {
      title: "Feedback",
      icon: MessageSquare,
      url: "/admin/feedback",
      show: canShowFeedbackNav(session),
    },
    {
      title: "Rate Limits",
      icon: ShieldAlert,
      url: "/admin/rate-limits",
      show: canShowRateLimitsNav(session),
    },
    {
      title: "Visitors",
      icon: Activity,
      url: "/admin/visitors",
      show: canShowVisitorsNav(session),
    },
    {
      title: "Activity",
      icon: History,
      url: "/admin/activity",
      show: canShowActivityNav(session),
    },
    {
      title: "Mail",
      icon: Mail,
      url: "/admin/mail",
      show: canShowMailNav(session),
    },
    {
      title: "Webhooks",
      icon: Webhook,
      url: "/admin/webhooks",
      show: canShowWebhooksNav(session),
    },
  ];
}

function AdminLayout() {
  const location = useLocation();
  const { session } = useSession();
  const visibleNavItems = getAdminNavItems(session).filter((item) => item.show);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar variant="floating" collapsible="icon">
          <SidebarHeader className="h-16 border-b px-2 justify-center flex flex-col">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  tooltip="Mail Kit"
                  render={(buttonProps) => <BrandMark {...buttonProps} />}
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleNavItems.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={item.title}
                          size="lg"
                          render={(buttonProps) => (
                            <Link
                              to={item.url}
                              {...buttonProps}
                              className={
                                buttonProps.className +
                                " group-data-[collapsible=icon]:justify-center"
                              }
                            >
                              <item.icon className="h-4 w-4" />
                              <span className="group-data-[collapsible=icon]:hidden">
                                {item.title}
                              </span>
                            </Link>
                          )}
                        />
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="flex flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <div className="h-4 w-[1px] bg-border mx-2" />
              <nav className="flex items-center space-x-1 text-sm font-medium">
                <span className="text-muted-foreground">Admin</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">
                  {location.pathname.split("/").pop()}
                </span>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 p-6 overflow-y-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
