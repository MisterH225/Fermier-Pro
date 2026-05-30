import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { MarketplaceListingFormFields } from "../components/marketplace/MarketplaceListingFormFields";
import { MobileAppShell } from "../components/layout";
import { useSession } from "../context/SessionContext";
import { useScrollBottomPad } from "../hooks/useScrollBottomPad";
import {
  createMarketplaceListing,
  fetchFarmAnimals,
  fetchFarms
} from "../lib/api";
import {
  buildMarketplaceListingPayload,
  EMPTY_MARKETPLACE_LISTING_FORM,
  type MarketplaceListingFormValues
} from "../lib/marketplaceListingForm";
import { marketplaceActionErrorMessage } from "../lib/marketplaceLabels";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "CreateMarketplaceListing">;

export function CreateMarketplaceListingScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();
  const scrollBottomPad = useScrollBottomPad();

  const initialFarmId = route.params?.farmId ?? null;
  const lockFarm = Boolean(initialFarmId);

  const [values, setValues] = useState<MarketplaceListingFormValues>({
    ...EMPTY_MARKETPLACE_LISTING_FORM,
    farmId: initialFarmId
  });

  const farmsQ = useQuery({
    queryKey: ["farms", activeProfileId],
    queryFn: () => fetchFarms(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const animalsQ = useQuery({
    queryKey: ["farmAnimals", values.farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken!, values.farmId!, activeProfileId),
    enabled: Boolean(values.farmId && accessToken)
  });

  const mut = useMutation({
    mutationFn: () =>
      createMarketplaceListing(
        accessToken!,
        buildMarketplaceListingPayload(values, t),
        activeProfileId
      ),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
      void qc.invalidateQueries({ queryKey: ["marketplaceListings"] });
      navigation.replace("MarketplaceListingDetail", {
        listingId: created.id,
        headline: created.title
      });
    },
    onError: (e: Error) =>
      Alert.alert(
        t("marketScreen.createForm.errorTitle"),
        marketplaceActionErrorMessage(e.message)
      )
  });

  const canSubmit =
    Boolean(values.title.trim()) &&
    Boolean(values.totalWeightKg.trim()) &&
    Boolean(values.pricePerKg.trim()) &&
    (!values.farmId || values.selectedAnimalIds.length > 0);

  if (!clientFeatures.marketplace) {
    return (
      <MarketplaceModuleGate>
        <View />
      </MarketplaceModuleGate>
    );
  }

  return (
    <MobileAppShell hideTopBar>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <MarketplaceListingFormFields
            values={values}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            farms={farmsQ.data ?? []}
            animals={animalsQ.data ?? []}
            farmsLoading={farmsQ.isPending}
            animalsLoading={animalsQ.isPending}
            lockFarm={lockFarm}
          />

          <Pressable
            style={[styles.submit, mut.isPending && styles.submitDisabled]}
            disabled={mut.isPending || !canSubmit}
            onPress={() => mut.mutate()}
          >
            {mut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitTx}>
                {t("marketScreen.createForm.submit")}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.md
  },
  submit: {
    marginTop: mobileSpacing.sm,
    backgroundColor: mobileColors.accent,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    minHeight: 48
  },
  submitDisabled: { opacity: 0.55 },
  submitTx: {
    ...mobileTypography.body,
    color: "#fff",
    fontWeight: "700"
  }
});
