import AsyncStorage from "@react-native-async-storage/async-storage";
import { focusManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
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
import { MainNavigationShell } from "./src/components/MainNavigationShell";
import { SessionProvider } from "./src/context/SessionContext";
import { isAuthEnvConfigured } from "./src/env";
import {
  QUERY_PERSIST_STORAGE_KEY,
  asyncStoragePersister,
  shouldPersistQuery
} from "./src/lib/queryPersist";
import { queryClient } from "./src/lib/queryClient";
import { getSupabase } from "./src/lib/supabase";
import { LoginGateScreen } from "./src/screens/LoginGateScreen";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const authConfigured = isAuthEnvConfigured();

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

  const signOut = async () => {
    await AsyncStorage.removeItem(QUERY_PERSIST_STORAGE_KEY).catch(
      () => undefined
    );
    queryClient.clear();
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const inMainNav = Boolean(authConfigured && session);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar style={inMainNav ? "light" : "dark"} />
        {authConfigured && session === undefined ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#5d7a1f" />
          </View>
        ) : authConfigured && session ? (
          <SessionProvider
            accessToken={session.access_token}
            signOut={signOut}
          >
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{
                persister: asyncStoragePersister,
                maxAge: 1000 * 60 * 60 * 24,
                dehydrateOptions: {
                  shouldDehydrateQuery: shouldPersistQuery
                }
              }}
            >
              <MainNavigationShell />
            </PersistQueryClientProvider>
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
    backgroundColor: "#f9f8ea"
  }
});
