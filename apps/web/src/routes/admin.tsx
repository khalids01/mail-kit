import {
  createFileRoute,
  Outlet,
  Link,
  useLocation,
  redirect,
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
} from "lucide-react";
import UserMenu from "@/components/core/user-menu";
import { ThemeToggle } from "@/components/core/theme-toggle";
import { NotificationBell } from "@/components/core/notification-bell";
import Logo from "@/components/core/logo";
import { Permissions } from "@rbac";
import { sessionHasPermission } from "@/features/user/lib/session-permissions";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    const session = context.session;

    if (!session) {
      throw redirect({
        to: "/login",
      });
    }

    if (
      !sessionHasPermission(
        session.permissions,
        Permissions.AdminAccess,
      )
    ) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
  component: AdminLayout,
});

const navItems = [
  {
    title: "Overview",
    icon: LayoutDashboard,
    url: "/admin/overview",
  },
  {
    title: "Users",
    icon: Users,
    url: "/admin/users",
  },
  {
    title: "Feedback",
    icon: MessageSquare,
    url: "/admin/feedback",
  },
  {
    title: "Rate Limits",
    icon: ShieldAlert,
    url: "/admin/rate-limits",
  },
  {
    title: "Visitors",
    icon: Activity,
    url: "/admin/visitors",
  },
  {
    title: "Activity",
    icon: History,
    url: "/admin/activity",
  },
  {
    title: "Webhooks",
    icon: Webhook,
    url: "/admin/webhooks",
  },
];

function AdminLayout() {
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar variant="floating" collapsible="icon">
          <SidebarHeader className="h-16 border-b px-2 justify-center flex flex-col">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  tooltip="Logo"
                  render={(buttonProps) => <Logo {...buttonProps} />}
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
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
