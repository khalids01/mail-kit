import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Mail, Moon, Sun } from "lucide-react";
import UserMenu from "@/components/core/user-menu";

export const LandingNav = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="h-14">
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 h-14 border-b bg-background/90 backdrop-blur",
        )}
      >
        <div className="container mx-auto flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="flex items-center gap-2 text-lg font-semibold tracking-tight"
            >
              <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Mail className="size-4" />
              </span>
              Mail Kit
            </Link>
            <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
              <a href="#features" className="hover:text-foreground">
                Features
              </a>
              <a href="#pricing" className="hover:text-foreground">
                Status
              </a>
              <a href="#testimonials" className="hover:text-foreground">
                Use cases
              </a>
              <a href="#faq" className="hover:text-foreground">
                FAQ
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-md"
            >
              {theme === "dark" ? (
                <Sun className="size-5" />
              ) : (
                <Moon className="size-5" />
              )}
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>
    </div>
  );
};
