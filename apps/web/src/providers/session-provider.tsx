import { createContext, useContext } from "react";
import type { ClientSessionResult } from "@/features/user/lib/client-session";


type SessionContextValue = {
  session: ClientSessionResult;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: ClientSessionResult;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={{ session }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider.");
  }
  return context;
}
