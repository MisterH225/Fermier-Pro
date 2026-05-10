import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { AuthMeResponse, ClientConfigDto } from "../lib/api";
import { fetchAuthMe, fetchClientConfig } from "../lib/api";

const STORAGE_PROFILE_KEY = "@fermier_pro/active_profile_id";

const DEFAULT_CLIENT_FEATURES: ClientConfigDto["features"] = {
  marketplace: true,
  chat: true,
  vetConsultations: true,
  tasks: true,
  finance: true,
  housing: true,
  feedStock: true
};

type SessionContextValue = {
  accessToken: string;
  signOut: () => Promise<void>;
  /** GET /auth/me (profils + profil actif côté API si header envoyé) */
  authMe: AuthMeResponse | null;
  authLoading: boolean;
  authError: string | null;
  activeProfileId: string | null;
  setActiveProfileId: (id: string | null) => Promise<void>;
  refreshAuthMe: () => Promise<void>;
  /** GET /config/client — défaut tout activé si échec réseau */
  clientFeatures: ClientConfigDto["features"];
};

const SessionContext = createContext<SessionContextValue | null>(null);

function pickDefaultProfileId(me: AuthMeResponse): string | null {
  if (me.activeProfile) {
    return me.activeProfile.id;
  }
  const def = me.profiles.find((p) => p.isDefault);
  if (def) {
    return def.id;
  }
  return me.profiles[0]?.id ?? null;
}

export function SessionProvider({
  accessToken,
  signOut: signOutProp,
  children
}: {
  accessToken: string;
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const [authMe, setAuthMe] = useState<AuthMeResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(
    null
  );
  const [clientFeatures, setClientFeatures] =
    useState<ClientConfigDto["features"]>(DEFAULT_CLIENT_FEATURES);

  useEffect(() => {
    let cancelled = false;
    void fetchClientConfig()
      .then((cfg) => {
        if (!cancelled) {
          setClientFeatures(cfg.features);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClientFeatures({ ...DEFAULT_CLIENT_FEATURES });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bootstrap = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const stored = await AsyncStorage.getItem(STORAGE_PROFILE_KEY);
      const initial = await fetchAuthMe(accessToken);
      const ids = new Set(initial.profiles.map((p) => p.id));
      let chosen =
        stored && ids.has(stored)
          ? stored
          : pickDefaultProfileId(initial);
      if (chosen && !ids.has(chosen)) {
        chosen = pickDefaultProfileId(initial);
      }
      if (chosen) {
        await AsyncStorage.setItem(STORAGE_PROFILE_KEY, chosen);
        const withProfile = await fetchAuthMe(accessToken, chosen);
        setAuthMe(withProfile);
        setActiveProfileIdState(chosen);
      } else {
        setAuthMe(initial);
        setActiveProfileIdState(null);
      }
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
      setAuthMe(null);
      setActiveProfileIdState(null);
    } finally {
      setAuthLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const refreshAuthMe = useCallback(async () => {
    try {
      setAuthError(null);
      const me = activeProfileId
        ? await fetchAuthMe(accessToken, activeProfileId)
        : await fetchAuthMe(accessToken);
      setAuthMe(me);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
    }
  }, [accessToken, activeProfileId]);

  const setActiveProfileId = useCallback(
    async (id: string | null) => {
      setAuthError(null);
      setActiveProfileIdState(id);
      if (id) {
        await AsyncStorage.setItem(STORAGE_PROFILE_KEY, id);
        try {
          const me = await fetchAuthMe(accessToken, id);
          setAuthMe(me);
        } catch (e) {
          setAuthError(e instanceof Error ? e.message : String(e));
        }
      } else {
        await AsyncStorage.removeItem(STORAGE_PROFILE_KEY);
        try {
          const me = await fetchAuthMe(accessToken);
          setAuthMe(me);
        } catch (e) {
          setAuthError(e instanceof Error ? e.message : String(e));
        }
      }
    },
    [accessToken]
  );

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_PROFILE_KEY).catch(() => undefined);
    await signOutProp();
  }, [signOutProp]);

  const value = useMemo<SessionContextValue>(
    () => ({
      accessToken,
      signOut,
      authMe,
      authLoading,
      authError,
      activeProfileId,
      setActiveProfileId,
      refreshAuthMe,
      clientFeatures
    }),
    [
      accessToken,
      signOut,
      authMe,
      authLoading,
      authError,
      activeProfileId,
      setActiveProfileId,
      refreshAuthMe,
      clientFeatures
    ]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession hors SessionProvider");
  }
  return ctx;
}
