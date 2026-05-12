import AsyncStorage from "@react-native-async-storage/async-storage";
import { focusManager } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  StyleSheet,
  View
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { AuthenticatedAppShell } from "./src/components/AuthenticatedAppShell";
import { SessionProvider } from "./src/context/SessionContext";
import {
  isAuthEnvConfigured,
  isDemoNavigationOffered
} from "./src/env";
import { DEMO_BYPASS_ACCESS_TOKEN } from "./src/lib/demoBypass";
import {
  QUERY_PERSIST_STORAGE_KEY,
} from "./src/lib/queryPersist";
import { queryClient } from "./src/lib/queryClient";
import { getSupabase } from "./src/lib/supabase";
import i18n from "./src/i18n/i18n";
import { getStoredAppLocale } from "./src/lib/appLocale";
import { LoginGateScreen } from "./src/screens/LoginGateScreen";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [demoBypass, setDemoBypass] = useState(false);
  const authConfigured = isAuthEnvConfigured();
  const bypassAllowed = isDemoNavigationOffered();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setSession(null);
      return;
    }

    const handleAppState = (next: AppStateStatus) => {
      focusManager.setFocused(next === "active");
      if (next === "active") {
        void supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };
    const appSub = AppState.addEventListener("change", handleAppState);
    focusManager.setFocused(AppState.currentState === "active");
    if (AppState.currentState === "active") {
      void supabase.auth.startAutoRefresh();
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session ?? null));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      appSub.remove();
      sub.subscription.unsubscribe();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      void queryClient.invalidateQueries();
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (session === null) {
      queryClient.clear();
    }
  }, [session]);

  useEffect(() => {
    void getStoredAppLocale().then((lng) => {
      void i18n.changeLanguage(lng);
    });
  }, []);

  const signOut = async () => {
    if (demoBypass) {
      setDemoBypass(false);
    }
    await AsyncStorage.removeItem(QUERY_PERSIST_STORAGE_KEY).catch(
      () => undefined
    );
    queryClient.clear();
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const inMainNav = Boolean(
    (authConfigured && session) || (bypassAllowed && demoBypass)
  );

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {authConfigured && session === undefined ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#1B3B2E" />
          </View>
        ) : inMainNav ? (
          <SessionProvider
            accessToken={
              authConfigured && session
                ? session.access_token
                : bypassAllowed && demoBypass
                  ? DEMO_BYPASS_ACCESS_TOKEN
                  : ""
            }
            signOut={signOut}
          >
            <AuthenticatedAppShell />
          </SessionProvider>
        ) : (
          <LoginGateScreen
            bypassAllowed={bypassAllowed}
            onEnterDemoBypass={() => setDemoBypass(true)}
          />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff"
  }
});
