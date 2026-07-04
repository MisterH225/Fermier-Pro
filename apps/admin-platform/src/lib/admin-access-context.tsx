"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { fetchAdminMe } from "@/lib/admin-auth";
import {
  type AdminAccessProfile,
  profileFromAdminMe
} from "@/lib/admin-permissions";
import { useAdminToken } from "@/lib/useAdminToken";

type AdminAccessContextValue = {
  ready: boolean;
  profile: AdminAccessProfile | null;
};

const AdminAccessContext = createContext<AdminAccessContextValue>({
  ready: false,
  profile: null
});

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const { token, ready: tokenReady } = useAdminToken();
  const [profile, setProfile] = useState<AdminAccessProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tokenReady) {
      return;
    }
    if (!token) {
      setProfile(null);
      setReady(true);
      return;
    }
    setReady(false);
    void fetchAdminMe(token)
      .then((me) => setProfile(profileFromAdminMe(me)))
      .catch(() => setProfile(null))
      .finally(() => setReady(true));
  }, [token, tokenReady]);

  const value = useMemo(
    () => ({ ready, profile }),
    [ready, profile]
  );

  return (
    <AdminAccessContext.Provider value={value}>
      {children}
    </AdminAccessContext.Provider>
  );
}

export function useAdminAccess() {
  return useContext(AdminAccessContext);
}
