import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import {
  asyncStoragePersister,
  shouldPersistQuery
} from "../lib/queryPersist";
import { queryClient } from "../lib/queryClient";
import { isDemoBypassToken } from "../lib/demoBypass";
import { AppModalsLayer } from "./modals";
import { ModalProvider } from "../context/ModalContext";
import { MainNavigationShell } from "./MainNavigationShell";
import { FirstConnectionProfileScreen } from "../screens/FirstConnectionProfileScreen";

/**
 * Après SessionProvider : onboarding profil si aucun profil API, sinon navigation principale.
 */
export function AuthenticatedAppShell() {
  const {
    authLoading,
    authMe,
    authError,
    accessToken,
    reloadAuth
  } = useSession();
  const demo = isDemoBypassToken(accessToken);

  if (!demo && authLoading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#1B3B2E" />
      </View>
    );
  }

  if (!demo && authError && !authMe) {
    return (
      <View style={styles.loaderWrap}>
        <Text style={styles.errText}>{authError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void reloadAuth()}>
          <Text style={styles.retryLabel}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!demo && authMe && authMe.profiles.length === 0) {
    return <FirstConnectionProfileScreen />;
  }

  return (
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
      <ModalProvider>
        <MainNavigationShell />
        <AppModalsLayer />
      </ModalProvider>
    </PersistQueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 24
  },
  errText: {
    color: "#B91C1C",
    textAlign: "center",
    marginBottom: 16
  },
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#1B3B2E",
    borderRadius: 24
  },
  retryLabel: {
    color: "#fff",
    fontWeight: "600"
  }
});
