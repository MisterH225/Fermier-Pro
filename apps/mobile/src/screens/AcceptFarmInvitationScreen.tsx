import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import { InviteQrScannerModal } from "../components/collaboration/InviteQrScannerModal";
import {
  acceptFarmInvitationWithToken,
  fetchInvitationByToken
} from "../lib/api";
import { clearPendingInviteToken } from "../lib/pendingInviteToken";
import { getQueryErrorMessage, getUserFacingError } from "../lib/userFacingError";
import { mobileColors, mobileRadius, mobileSpacing, mobileStatusSurfaces, mobileTypography, mobileFontSize } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";
import { useBottomInset } from "../hooks/useBottomInset";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "AcceptFarmInvitation"
>;

function roleHint(role: string | null | undefined): string {
  switch (role) {
    case "worker":
      return "technicien";
    case "viewer":
      return "observateur";
    case "veterinarian":
      return "intervenant vétérinaire";
    case "manager":
      return "gérant";
    case "owner":
      return "propriétaire";
    default:
      return role ? `membre (${role})` : "membre";
  }
}

export function AcceptFarmInvitationScreen({ route, navigation }: Props) {
  const bottomInset = useBottomInset();
  const prefill = route.params?.prefilledToken
    ? decodeURIComponent(route.params.prefilledToken)
    : "";
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const [token, setToken] = useState(prefill);
  const [scannerVisible, setScannerVisible] = useState(false);

  useEffect(() => {
    if (prefill) {
      setToken(prefill);
      void clearPendingInviteToken();
    }
  }, [prefill]);

  const normalizedToken = token.trim();

  const previewQuery = useQuery({
    queryKey: ["invitationPreview", normalizedToken, activeProfileId],
    queryFn: () =>
      fetchInvitationByToken(accessToken, normalizedToken, activeProfileId),
    enabled: Boolean(accessToken && normalizedToken.length >= 16),
    retry: false
  });

  const accept = useMutation({
    mutationFn: () =>
      acceptFarmInvitationWithToken(
        accessToken,
        normalizedToken,
        activeProfileId
      ),
    onSuccess: async (res) => {
      await clearPendingInviteToken();
      void qc.invalidateQueries({ queryKey: ["farms", activeProfileId] });
      void qc.invalidateQueries({ queryKey: ["farm"] });
      void qc.invalidateQueries({ queryKey: ["vetDashboard"] });
      Alert.alert(
        res.alreadyMember ? t("invite.alreadyMemberTitle") : t("invite.welcomeTitle"),
        res.alreadyMember
          ? t("invite.alreadyMemberBody")
          : t("invite.welcomeBody", { role: roleHint(res.role) }),
        [
          {
            text: t("invite.openMyFarms"),
            onPress: () => navigation.navigate("FarmList")
          }
        ]
      );
    },
    onError: (e: Error) => Alert.alert(t("invite.refusedTitle"), getUserFacingError(e, t))
  });

  const previewError = getQueryErrorMessage(previewQuery.error, t);
  const preview = previewQuery.data;
  const isScanRequest =
    preview && preview.isDefault && !preview.isOwner && !preview.alreadyMember;
  const isAlreadyMember = preview?.alreadyMember;
  const isOwner = preview?.isOwner;

  return (
    <>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      keyboardShouldPersistTaps="handled"
    >
      {prefill && previewQuery.isLoading ? (
        <View style={styles.previewLoading}>
          <ActivityIndicator color={mobileColors.accent} />
        </View>
      ) : null}

      {previewError ? (
        <View style={styles.errorCard}>
          <Ionicons
            name="alert-circle-outline"
            size={22}
            color={mobileColors.error}
          />
          <Text style={styles.errorText}>{previewError}</Text>
        </View>
      ) : null}

      {preview ? (
        <View style={styles.previewCard}>
          <View style={styles.previewIconWrap}>
            <Ionicons
              name={
                isOwner
                  ? "shield-checkmark-outline"
                  : isAlreadyMember
                    ? "checkmark-circle-outline"
                    : isScanRequest
                      ? "hourglass-outline"
                      : "leaf-outline"
              }
              size={26}
              color={mobileColors.accent}
            />
          </View>
          <Text style={styles.previewFarm} numberOfLines={1}>
            {preview.farmName}
          </Text>
          <Text style={styles.previewSub}>
            {isOwner
              ? t("invite.previewOwner")
              : isAlreadyMember
                ? t("invite.previewAlreadyMember", {
                    role: roleHint(preview.role)
                  })
                : isScanRequest
                  ? t("invite.previewScanRequest")
                  : t("invite.previewShareLink", {
                      role: roleHint(preview.role)
                    })}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.scanCta}
        onPress={() => setScannerVisible(true)}
        accessibilityRole="button"
      >
        <Ionicons name="qr-code-outline" size={20} color={mobileColors.accent} />
        <Text style={styles.scanCtaTxt}>{t("invite.scanQrCta")}</Text>
      </TouchableOpacity>

      <Text style={styles.intro}>{t("invite.introText")}</Text>
      <Text style={styles.label}>{t("invite.tokenLabel")}</Text>
      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder={t("invite.tokenPlaceholder")}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />

      {isScanRequest ? (
        <Text style={styles.scanNote}>{t("invite.scanRequestNote")}</Text>
      ) : isOwner ? (
        <Text style={styles.scanNote}>{t("invite.ownerNote")}</Text>
      ) : isAlreadyMember ? (
        <Text style={styles.scanNote}>{t("invite.alreadyMemberNote")}</Text>
      ) : (
        <TouchableOpacity
          style={[styles.cta, accept.isPending && styles.ctaDisabled]}
          disabled={accept.isPending || normalizedToken.length < 16}
          onPress={() => accept.mutate()}
        >
          <Text style={styles.ctaTxt}>
            {accept.isPending ? t("invite.validating") : t("invite.joinCta")}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>

    <InviteQrScannerModal
      visible={scannerVisible}
      onClose={() => setScannerVisible(false)}
      onTokenScanned={(scanned) => {
        setToken(scanned);
        void qc.invalidateQueries({
          queryKey: ["invitationPreview", scanned.trim(), activeProfileId]
        });
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: mobileColors.canvas },
  content: {
    padding: mobileSpacing.lg,

    gap: mobileSpacing.md
  },
  previewLoading: {
    paddingVertical: mobileSpacing.xl,
    alignItems: "center"
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.sm,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileStatusSurfaces.errorBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.error
  },
  errorText: {
    ...mobileTypography.body,
    flex: 1,
    fontSize: mobileFontSize.md,
    color: mobileColors.error,
    lineHeight: 20
  },
  previewCard: {
    alignItems: "center",
    paddingVertical: mobileSpacing.lg,
    paddingHorizontal: mobileSpacing.lg,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    gap: 6
  },
  previewIconWrap: {
    width: 48,
    height: 48,
    borderRadius: mobileRadius.xl,
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6
  },
  previewFarm: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    textAlign: "center"
  },
  previewSub: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  scanCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  scanCtaTxt: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: mobileFontSize.md
  },
  intro: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary,
    lineHeight: 20
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.md,
    fontSize: mobileFontSize.md,
    backgroundColor: mobileColors.background,
    minHeight: 88,
    textAlignVertical: "top",
    color: mobileColors.textPrimary
  },
  scanNote: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: mobileSpacing.sm,
    paddingTop: mobileSpacing.sm
  },
  cta: {
    marginTop: mobileSpacing.lg,
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  ctaDisabled: { opacity: 0.55 },
  ctaTxt: { color: mobileColors.onAccent, fontWeight: "700", fontSize: mobileFontSize.lg }
});
