import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import SignInForm from "@/features/auth/sign-in-form";
import SignUpForm from "@/features/auth/sign-up-form";
import Logo from "@/components/core/logo";
import { getRootSession } from "@/features/user/lib/get-root-session";

export const Route = createFileRoute("/_auth/login")({
  beforeLoad: async ({ context }) => {
    const session = context.session ?? (await getRootSession());
    if (session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <>
      <header className="border-b">
        <div className="container mx-auto py-3 max-w-6xl">
          <div className="flex items-center justify-between">
         <Logo/> 
            <nav className="flex items-center gap-8">
              <a href="#" className="text-sm font-medium">Home</a>
            </nav>
          </div>
        </div>
      </header>
      {showSignIn ? (
        <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
      )}
    </>
  )
}
