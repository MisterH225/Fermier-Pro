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
import { isAuthEnvConfigured } from "./src/env";
import { clearOfflineStorage } from "./src/lib/offline/queueStore";
import { QUERY_PERSIST_STORAGE_KEY } from "./src/lib/queryPersist";
import { queryClient } from "./src/lib/queryClient";
import { getSupabase } from "./src/lib/supabase";
import i18n from "./src/i18n/i18n";
import { getStoredAppLocale } from "./src/lib/appLocale";
import { PendingInviteLinkListener } from "./src/components/PendingInviteLinkListener";
import { LoginGateScreen } from "./src/screens/LoginGateScreen";
import { useAppUpdates } from "./src/hooks/useAppUpdates";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const authConfigured = isAuthEnvConfigured();

  useAppUpdates();

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
    await AsyncStorage.removeItem(QUERY_PERSIST_STORAGE_KEY).catch(
      () => undefined
    );
    await clearOfflineStorage().catch(() => undefined);
    queryClient.clear();
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  return (
    <GestureHandlerRootView style={styles.flex}>
      <PendingInviteLinkListener />
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {authConfigured && session === undefined ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#1B3B2E" />
          </View>
        ) : session ? (
          <SessionProvider accessToken={session.access_token} signOut={signOut}>
            <AuthenticatedAppShell />
          </SessionProvider>
        ) : (
          <LoginGateScreen />
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
