import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, View } from "react-native";
import { MerchantKindSelector } from "../../components/merchant/MerchantKindSelector";
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
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

/**
 * Sections paramètres spécifiques commerçant (type standard/moulin, boutique).
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
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  loadingTx: {
    ...mobileTypography.meta,
    color: merchantColors.textSecondary
  }
});
