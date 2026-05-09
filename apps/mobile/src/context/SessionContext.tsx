import { createContext, useContext, type ReactNode } from "react";

type SessionContextValue = {
  accessToken: string;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  accessToken,
  signOut,
  children
}: {
  accessToken: string;
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={{ accessToken, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession hors SessionProvider");
  }
  return ctx;
}
