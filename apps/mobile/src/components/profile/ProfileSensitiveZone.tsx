import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import {
  deactivateProfile,
  fetchDeactivationPreview,
  reactivateProfile,
  type ProfileDeactivationPreviewDto,
  type ProfileTypeChoice
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import type { RootStackParamList } from "../../types/navigation";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { ProfileDeactivationSheet } from "./ProfileDeactivationSheet";

const PROFILE_TYPES: ProfileTypeChoice[] = [
  "producer",
  "technician",
  "veterinarian",
  "buyer",
  "merchant"
];

function isProfileType(value: string): value is ProfileTypeChoice {
  return (PROFILE_TYPES as string[]).includes(value);
}

function navigateResolveHint(
  navigation: NativeStackNavigationProp<RootStackParamList>,
  hint: string
): void {
  switch (hint) {
    case "farms":
      navigation.navigate("FarmList");
      break;
    case "marketplace/orders":
      navigation.navigate("BuyerHistory", { initialSegment: "active" });
      break;
    case "vet/agenda":
      navigation.navigate("VetAgenda");
      break;
    case "wallet/withdrawals":
      navigation.navigate("UserWallet");
      break;
    case "merchant/subscription":
      navigation.navigate("MerchantSubscription");
      break;
    case "merchant/orders":
      navigation.navigate("MerchantOrders");
      break;
    case "tech/tasks":
      navigation.navigate("TechTasks");
      break;
    default:
      break;
  }
}

export function ProfileSensitiveZone() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    accessToken,
    authMe,
    activeProfileId,
    setActiveProfileId,
    reloadAuth
  } = useSession();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProfileDeactivationPreviewDto | null>(
    null
  );
  const [sheetError, setSheetError] = useState<string | null>(null);

  const profiles = authMe?.profiles ?? [];
  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ??
    authMe?.activeProfile ??
    null;

  const activeProfiles = useMemo(
    () =>
      profiles.filter(
        (p) => !p.profileStatus || p.profileStatus === "active"
      ),
    [profiles]
  );

  const deactivatedProfiles = useMemo(
    () => profiles.filter((p) => p.profileStatus === "deactivated"),
    [profiles]
  );

  const isLastActive = activeProfiles.length <= 1;
  const activeType: ProfileTypeChoice | null =
    activeProfile && isProfileType(activeProfile.type)
      ? activeProfile.type
      : null;

  const canOfferDeactivate =
    !!activeProfile &&
    !!activeType &&
    activeProfile.profileStatus !== "deactivated" &&
    activeProfile.profileStatus !== "banned" &&
    activeProfile.profileStatus !== "suspended";

  const openSheet = useCallback(async () => {
    if (!activeProfile || !accessToken) {
      return;
    }
    setSheetOpen(true);
    setPreview(null);
    setSheetError(null);
    setPreviewLoading(true);
    try {
      const data = await fetchDeactivationPreview(
        accessToken,
        activeProfile.id,
        activeProfileId
      );
      setPreview(data);
    } catch (err) {
      setSheetError(formatApiError(err));
    } finally {
      setPreviewLoading(false);
    }
  }, [accessToken, activeProfile, activeProfileId]);

  const onConfirmDeactivate = useCallback(async () => {
    if (!activeProfile || !accessToken || !preview?.canDeactivate) {
      return;
    }
    setSubmitting(true);
    setSheetError(null);
    try {
      const result = await deactivateProfile(
        accessToken,
        activeProfile.id,
        undefined,
        activeProfileId
      );
      if (result.suggestedActiveProfileId) {
        await setActiveProfileId(result.suggestedActiveProfileId);
      }
      await reloadAuth();
      setSheetOpen(false);
      setPreview(null);
      Alert.alert(
        t("account.sensitiveZone.successTitle"),
        t("account.sensitiveZone.successMessage")
      );
    } catch (err) {
      setSheetError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }, [
    accessToken,
    activeProfile,
    activeProfileId,
    preview?.canDeactivate,
    reloadAuth,
    setActiveProfileId,
    t
  ]);

  const onReactivate = useCallback(
    async (profileId: string) => {
      if (!accessToken) {
        return;
      }
      setReactivatingId(profileId);
      try {
        await reactivateProfile(accessToken, profileId, activeProfileId);
        await reloadAuth();
        Alert.alert(
          t("account.sensitiveZone.reactivateSuccessTitle"),
          t("account.sensitiveZone.reactivateSuccessMessage")
        );
      } catch (err) {
        Alert.alert(
          t("account.sensitiveZone.reactivateErrorTitle"),
          formatApiError(err)
        );
      } finally {
        setReactivatingId(null);
      }
    },
    [accessToken, activeProfileId, reloadAuth, t]
  );

  const onResolveBlock = useCallback(
    (hint: string) => {
      setSheetOpen(false);
      navigateResolveHint(navigation, hint);
    },
    [navigation]
  );

  if (!authMe) {
    return null;
  }

  return (
    <View style={styles.wrap} testID="profile-sensitive-zone">
      <View style={styles.sep} />
      <Text style={styles.zoneLabel}>{t("account.sensitiveZone.label")}</Text>
      <Text style={styles.zoneHint}>{t("account.sensitiveZone.hint")}</Text>

      {canOfferDeactivate && activeType ? (
        <>
          <Pressable
            style={[styles.deactivateBtn, isLastActive && styles.btnDisabled]}
            onPress={() => {
              if (!isLastActive) {
                void openSheet();
              }
            }}
            disabled={isLastActive}
            accessibilityRole="button"
            accessibilityState={{ disabled: isLastActive }}
            accessibilityLabel={t("account.sensitiveZone.deactivate")}
            testID="deactivate-profile-btn"
          >
            <Ionicons
              name="pause-circle-outline"
              size={18}
              color={
                isLastActive
                  ? mobileColors.textSecondary
                  : mobileColors.error
              }
              style={styles.btnIcon}
            />
            <Text
              style={[
                styles.deactivateTx,
                isLastActive && styles.deactivateTxDisabled
              ]}
            >
              {t("account.sensitiveZone.deactivate")}
            </Text>
          </Pressable>
          {isLastActive ? (
            <Text style={styles.lastActiveMsg}>
              {t("account.sensitiveZone.lastProfileHint")}
            </Text>
          ) : null}
        </>
      ) : null}

      {deactivatedProfiles.length > 0 ? (
        <View style={styles.deactivatedSection}>
          <Text style={styles.deactivatedTitle}>
            {t("account.sensitiveZone.deactivatedTitle")}
          </Text>
          {deactivatedProfiles.map((profile) => {
            const typeLabel = isProfileType(profile.type)
              ? t(`account.profileTypes.${profile.type}`)
              : profile.type;
            const busy = reactivatingId === profile.id;
            return (
              <View key={profile.id} style={styles.deactivatedRow}>
                <View style={styles.deactivatedInfo}>
                  <Text style={styles.deactivatedName}>
                    {profile.displayName?.trim() || typeLabel}
                  </Text>
                  <Text style={styles.deactivatedMeta}>{typeLabel}</Text>
                </View>
                <Pressable
                  style={styles.reactivateBtn}
                  onPress={() => void onReactivate(profile.id)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={t("account.sensitiveZone.reactivate")}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={mobileColors.accent} />
                  ) : (
                    <Text style={styles.reactivateTx}>
                      {t("account.sensitiveZone.reactivate")}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {activeType ? (
        <ProfileDeactivationSheet
          visible={sheetOpen}
          loading={previewLoading}
          submitting={submitting}
          preview={preview}
          profileType={activeType}
          errorMessage={sheetError}
          onClose={() => {
            setSheetOpen(false);
            setPreview(null);
            setSheetError(null);
          }}
          onConfirm={() => void onConfirmDeactivate()}
          onResolveBlock={onResolveBlock}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: mobileSpacing.md
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: mobileColors.border,
    marginBottom: mobileSpacing.md
  },
  zoneLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.xs,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  zoneHint: {
    ...mobileTypography.meta,
    fontSize: 12,
    color: mobileColors.textSecondary,
    marginLeft: 4,
    marginBottom: mobileSpacing.sm,
    lineHeight: 17
  },
  deactivateBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.sm
  },
  btnDisabled: {
    opacity: 0.55
  },
  btnIcon: {
    marginRight: 8
  },
  deactivateTx: {
    ...mobileTypography.body,
    fontSize: 15,
    color: mobileColors.error,
    fontWeight: "500"
  },
  deactivateTxDisabled: {
    color: mobileColors.textSecondary
  },
  lastActiveMsg: {
    ...mobileTypography.meta,
    fontSize: 12,
    color: mobileColors.textSecondary,
    marginLeft: 4,
    marginBottom: mobileSpacing.sm,
    lineHeight: 17
  },
  deactivatedSection: {
    marginTop: mobileSpacing.sm,
    gap: mobileSpacing.sm
  },
  deactivatedTitle: {
    ...mobileTypography.meta,
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginLeft: 4
  },
  deactivatedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.sm,
    gap: mobileSpacing.md
  },
  deactivatedInfo: {
    flex: 1
  },
  deactivatedName: {
    ...mobileTypography.body,
    fontSize: 15,
    color: mobileColors.textPrimary,
    fontWeight: "500"
  },
  deactivatedMeta: {
    ...mobileTypography.meta,
    fontSize: 12,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  reactivateBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 88,
    alignItems: "center"
  },
  reactivateTx: {
    ...mobileTypography.body,
    fontSize: 14,
    color: mobileColors.accent,
    fontWeight: "600"
  }
});
