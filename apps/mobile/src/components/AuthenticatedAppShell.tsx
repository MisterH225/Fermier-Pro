import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import { ActiveProjectProvider } from "../context/ActiveProjectContext";
import {
  asyncStoragePersister,
  shouldPersistQuery
} from "../lib/queryPersist";
import { queryClient } from "../lib/queryClient";
import { OfflineSyncProvider } from "../context/OfflineSyncContext";
import { AppModalsLayer } from "./modals";
import { ModalProvider } from "../context/ModalContext";
import { OnboardingResumeProvider } from "../context/OnboardingResumeContext";
import { useOnboardingResume } from "../context/OnboardingResumeContext";
import {
  getProducerOnboardingState,
  shouldShowOnboardingScreen
} from "../lib/onboardingState";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { MainNavigationShell } from "./MainNavigationShell";
import { useCGUStatus } from "../hooks/useCGUStatus";
import { CGUScreen } from "../screens/onboarding/CGUScreen";
import { FirstConnectionProfileScreen } from "../screens/FirstConnectionProfileScreen";
import { OnboardingScreen } from "../screens/onboarding/OnboardingScreen";
import { VetOnboardingScreen } from "../screens/onboarding/vet/VetOnboardingScreen";
import { needsVetOnboarding } from "../lib/vetOnboardingState";
import { TechOnboardingScreen } from "../screens/onboarding/technician/TechOnboardingScreen";
import { BuyerOnboardingScreen } from "../screens/onboarding/buyer/BuyerOnboardingScreen";
import { needsTechOnboarding } from "../lib/techOnboardingState";
import { needsBuyerOnboarding } from "../lib/buyerOnboardingState";
import { needsMerchantOnboarding } from "../lib/merchantOnboardingState";
import { MerchantOnboardingScreen } from "../screens/onboarding/merchant/MerchantOnboardingScreen";
import { mobileColors, mobileRadius } from "../theme/mobileTheme";
import { producerColors } from "../theme/producerTheme";
import { uiNamedColors } from "../theme/uiNamedColors";

/**
 * Après SessionProvider : onboarding profil si aucun profil API, sinon navigation principale.
 */
function AuthenticatedAppShellInner() {
  const {
    authLoading,
    authMe,
    authError,
    accessToken,
    activeProfileId,
    reloadAuth,
    refreshAuthMe
  } = useSession();
  const { resumeActive } = useOnboardingResume();
  const cguStatus = useCGUStatus(authMe);

  if (authLoading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={uiNamedColors.c1B3B2E} />
      </View>
    );
  }

  if (authError && !authMe) {
    return (
      <View style={styles.loaderWrap}>
        <Text style={styles.errText}>{authError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void reloadAuth()}>
          <Text style={styles.retryLabel}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (authMe && cguStatus.needsAcceptance) {
    return (
      <CGUScreen
        onAccepted={() => {
          void refreshAuthMe();
        }}
      />
    );
  }

  if (authMe && authMe.profiles.length === 0) {
    return <FirstConnectionProfileScreen />;
  }

  if (needsVetOnboarding(authMe, activeProfileId)) {
    return (
      <VetOnboardingScreen
        onFinished={() => {
          void refreshAuthMe();
        }}
        onCancel={() => {
          void refreshAuthMe();
        }}
      />
    );
  }

  if (needsTechOnboarding(authMe, activeProfileId)) {
    return (
      <TechOnboardingScreen
        onFinished={() => {
          void refreshAuthMe();
        }}
        onCancel={() => {
          void refreshAuthMe();
        }}
      />
    );
  }

  if (needsBuyerOnboarding(authMe, activeProfileId)) {
    return (
      <BuyerOnboardingScreen
        onFinished={() => {
          void refreshAuthMe();
        }}
        onCancel={() => {
          void refreshAuthMe();
        }}
      />
    );
  }

  if (needsMerchantOnboarding(authMe, activeProfileId)) {
    return (
      <AppErrorBoundary>
        <MerchantOnboardingScreen
          onFinished={() => {
            void refreshAuthMe();
          }}
          onCancel={() => {
            void refreshAuthMe();
          }}
        />
      </AppErrorBoundary>
    );
  }

  const onboardingState = getProducerOnboardingState(authMe, activeProfileId);
  if (authMe && shouldShowOnboardingScreen(onboardingState, resumeActive)) {
    return (
      <OnboardingScreen
        onFinished={() => {
          void refreshAuthMe();
        }}
      />
    );
  }

  return (
    <AppErrorBoundary>
      <MainNavigationShell />
    </AppErrorBoundary>
  );
}

const queryPersistOptions = {
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24,
  dehydrateOptions: {
    shouldDehydrateQuery: shouldPersistQuery
  }
} as const;

export function AuthenticatedAppShell() {
  return (
    <OnboardingResumeProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={queryPersistOptions}
      >
        <OfflineSyncProvider>
          <ModalProvider>
            <ActiveProjectProvider>
              <AuthenticatedAppShellInner />
              <AppModalsLayer />
            </ActiveProjectProvider>
          </ModalProvider>
        </OfflineSyncProvider>
      </PersistQueryClientProvider>
    </OnboardingResumeProvider>
  );
}

const styles = StyleSheet.create({
  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: mobileColors.background,
    paddingHorizontal: 24
  },
  errText: {
    color: producerColors.dangerStrong,
    textAlign: "center",
    marginBottom: 16
  },
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: uiNamedColors.c1B3B2E,
    borderRadius: mobileRadius.xl
  },
  retryLabel: {
    color: mobileColors.background,
    fontWeight: "600"
  }
});
