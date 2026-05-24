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
import { formatApiError } from "../lib/apiErrors";
import { fetchAuthMe, fetchClientConfig } from "../lib/api";
const STORAGE_PROFILE_KEY = "@fermier_pro/active_profile_id";
const AUTH_ME_CACHE_KEY = "@fermier_pro/auth_me_cache";

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
  /** Recharge session / profils depuis l’API (ex. après erreur réseau). */
  reloadAuth: () => Promise<void>;
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
      /** Profil avec `isDefault` (choix de la premiere connexion), puis secours locaux. */
      const fromServer = pickDefaultProfileId(initial);
      let chosen: string | null = null;
      if (fromServer) {
        chosen = fromServer;
      } else if (stored && ids.has(stored)) {
        chosen = stored;
      } else {
        chosen = initial.profiles[0]?.id ?? null;
      }
      if (chosen && !ids.has(chosen)) {
        chosen = pickDefaultProfileId(initial) ?? initial.profiles[0]?.id ?? null;
      }
      if (chosen) {
        await AsyncStorage.setItem(STORAGE_PROFILE_KEY, chosen);
        const withProfile = await fetchAuthMe(accessToken, chosen);
        setAuthMe(withProfile);
        setActiveProfileIdState(chosen);
        await AsyncStorage.setItem(
          AUTH_ME_CACHE_KEY,
          JSON.stringify({ me: withProfile, profileId: chosen })
        );
      } else {
        setAuthMe(initial);
        setActiveProfileIdState(null);
        await AsyncStorage.setItem(
          AUTH_ME_CACHE_KEY,
          JSON.stringify({ me: initial, profileId: null })
        );
      }
    } catch (e) {
      const cachedRaw = await AsyncStorage.getItem(AUTH_ME_CACHE_KEY);
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as {
            me: AuthMeResponse;
            profileId: string | null;
          };
          setAuthMe(cached.me);
          setActiveProfileIdState(cached.profileId);
          setAuthError(null);
        } catch {
          setAuthError(formatApiError(e));
          setAuthMe(null);
          setActiveProfileIdState(null);
        }
      } else {
        setAuthError(formatApiError(e));
        setAuthMe(null);
        setActiveProfileIdState(null);
      }
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
      setAuthError(formatApiError(e));
    }
  }, [accessToken, activeProfileId]);

  const reloadAuth = useCallback(async () => {
    await bootstrap();
  }, [bootstrap]);

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
          setAuthError(formatApiError(e));
        }
      } else {
        await AsyncStorage.removeItem(STORAGE_PROFILE_KEY);
        try {
          const me = await fetchAuthMe(accessToken);
          setAuthMe(me);
        } catch (e) {
          setAuthError(formatApiError(e));
        }
      }
    },
    [accessToken]
  );

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_PROFILE_KEY).catch(() => undefined);
    await AsyncStorage.removeItem(AUTH_ME_CACHE_KEY).catch(() => undefined);
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
      reloadAuth,
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
      reloadAuth,
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
