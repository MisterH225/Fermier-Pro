import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { MerchantKindSelector } from "../../components/merchant/MerchantKindSelector";
import { MerchantLocationFields } from "../../components/merchant/MerchantLocationFields";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSection } from "../../components/settings/SettingsSection";
import { useSession } from "../../context/SessionContext";
import {
  fetchMerchantMe,
  patchMerchantProfile,
  type MerchantKind
} from "../../lib/api";
import { shouldAskMerchantKind } from "../../lib/merchantKind";
import { merchantColors } from "../../theme/merchantTheme";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

/**
 * Sections paramètres spécifiques commerçant (type standard/moulin, géoloc, boutique).
 */
export function MerchantSettingsSections() {
  const { t } = useTranslation();
  const {
    accessToken,
    activeProfileId,
    platformModules,
    refreshAuthMe,
    refreshClientConfig
  } = useSession();
  const queryClient = useQueryClient();
  const canEditMerchantKind = shouldAskMerchantKind(platformModules);
  const [savingKind, setSavingKind] = useState(false);
  const [savingLoc, setSavingLoc] = useState(false);
  const [location, setLocation] = useState({
    locationCity: "",
    latitude: null as number | null,
    longitude: null as number | null
  });

  const meQ = useQuery({
    queryKey: ["merchant-me", activeProfileId, "settings"],
    queryFn: () => fetchMerchantMe(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const me = meQ.data;
  const currentKind: MerchantKind = me?.merchantKind ?? "standard";
  const shopsLabel =
    me != null ? `${me.shopCount} / ${me.maxShops}` : "—";
  const mainShop = me?.shops?.[0]?.name?.trim() || "—";
  const productsLabel =
    me != null
      ? me.maxActiveProducts != null
        ? `${me.activeProductCount} / ${me.maxActiveProducts}`
        : String(me.activeProductCount)
      : "—";

  useEffect(() => {
    if (!me) return;
    setLocation({
      locationCity: me.locationCity ?? "",
      latitude: me.latitude ?? null,
      longitude: me.longitude ?? null
    });
  }, [me?.locationCity, me?.latitude, me?.longitude]);

  const onChangeMerchantKind = async (kind: MerchantKind) => {
    if (!accessToken || !activeProfileId || !canEditMerchantKind) return;
    if (currentKind === kind) return;
    setSavingKind(true);
    try {
      await refreshClientConfig();
      await patchMerchantProfile(accessToken, activeProfileId, {
        merchantKind: kind
      });
      await queryClient.invalidateQueries({
        queryKey: ["merchant-me", activeProfileId]
      });
      await meQ.refetch();
      await refreshAuthMe();
      Alert.alert(t("common.successTitle"), t("merchant.profile.merchantKindSaved"));
    } catch (e) {
      Alert.alert(
        "",
        e instanceof Error ? e.message : t("merchant.profile.merchantKindError")
      );
    } finally {
      setSavingKind(false);
    }
  };

  const onSaveLocation = async () => {
    if (!accessToken || !activeProfileId) return;
    setSavingLoc(true);
    try {
      await patchMerchantProfile(accessToken, activeProfileId, {
        locationCity: location.locationCity.trim() || null,
        latitude: location.latitude,
        longitude: location.longitude
      });
      await queryClient.invalidateQueries({
        queryKey: ["merchant-me", activeProfileId]
      });
      await meQ.refetch();
      Alert.alert(t("common.successTitle"), t("merchant.profile.locationSaved"));
    } catch (e) {
      Alert.alert(
        "",
        e instanceof Error ? e.message : t("merchant.profile.locationError")
      );
    } finally {
      setSavingLoc(false);
    }
  };

  return (
    <View testID="settings-merchant-sections">
      {canEditMerchantKind ? (
        <SettingsSection
          title={t("merchant.profile.merchantKind")}
          subtitle={t("merchant.profile.merchantKindHint")}
        >
          <View style={styles.kindPad} testID="settings-merchant-kind">
            {meQ.isPending && !me ? (
              <Text style={styles.loadingTx}>{t("common.loading")}</Text>
            ) : (
              <MerchantKindSelector
                value={currentKind}
                onChange={(kind) => void onChangeMerchantKind(kind)}
                saving={savingKind}
                testID="settings-merchant-kind"
              />
            )}
          </View>
        </SettingsSection>
      ) : null}

      <SettingsSection title={t("merchant.profile.locationSection")}>
        <View style={styles.locPad} testID="settings-merchant-location">
          <MerchantLocationFields
            value={location}
            onChange={setLocation}
            showMillNudge={Boolean(me?.needsLocationNudge)}
            testID="settings-merchant-location-fields"
          />
          <Pressable
            style={[styles.saveBtn, savingLoc && styles.saveBtnDisabled]}
            onPress={() => void onSaveLocation()}
            disabled={savingLoc}
            testID="settings-merchant-location-save"
          >
            {savingLoc ? (
              <ActivityIndicator color={mobileColors.background} />
            ) : (
              <Text style={styles.saveTx}>
                {t("merchant.profile.locationSave")}
              </Text>
            )}
          </Pressable>
        </View>
      </SettingsSection>

      <SettingsSection title={t("merchant.profile.sectionMerchant")}>
        <SettingsRow
          kind="value"
          label={t("merchant.profile.mainShop")}
          value={mainShop}
        />
        <SettingsRow
          kind="value"
          label={t("merchant.profile.shops")}
          value={shopsLabel}
        />
        <SettingsRow
          kind="value"
          label={t("merchant.profile.activeProducts")}
          value={productsLabel}
          isLast
        />
      </SettingsSection>
    </View>
  );
}

const styles = StyleSheet.create({
  kindPad: {
    paddingHorizontal: mobileSpacing.md,
    paddingBottom: mobileSpacing.md
  },
  locPad: {
    paddingHorizontal: mobileSpacing.md,
    paddingBottom: mobileSpacing.md,
    gap: mobileSpacing.md
  },
  loadingTx: {
    ...mobileTypography.body,
    color: merchantColors.textMuted
  },
  saveBtn: {
    backgroundColor: merchantColors.primary,
    borderRadius: mobileRadius.md,
    paddingVertical: 12,
    alignItems: "center"
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveTx: {
    color: mobileColors.background,
    fontWeight: "700",
    fontSize: mobileFontSize.md
  }
});
