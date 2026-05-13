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
import {
  acceptFarmInvitationWithToken,
  fetchInvitationByToken
} from "../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

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
  const prefill = route.params?.prefilledToken
    ? decodeURIComponent(route.params.prefilledToken)
    : "";
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const [token, setToken] = useState(prefill);

  useEffect(() => {
    if (prefill) setToken(prefill);
  }, [prefill]);

  const previewQuery = useQuery({
    queryKey: ["invitationPreview", prefill, activeProfileId],
    queryFn: () => fetchInvitationByToken(accessToken, prefill, activeProfileId),
    enabled: Boolean(accessToken && prefill && prefill.length >= 16)
  });

  const accept = useMutation({
    mutationFn: () =>
      acceptFarmInvitationWithToken(
        accessToken,
        token.trim(),
        activeProfileId
      ),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["farms", activeProfileId] });
      void qc.invalidateQueries({ queryKey: ["farm"] });
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
    onError: (e: Error) => Alert.alert(t("invite.refusedTitle"), e.message)
  });

  const preview = previewQuery.data;
  const isScanRequest =
    preview && preview.isDefault && !preview.isOwner && !preview.alreadyMember;
  const isAlreadyMember = preview?.alreadyMember;
  const isOwner = preview?.isOwner;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {prefill && previewQuery.isLoading ? (
        <View style={styles.previewLoading}>
          <ActivityIndicator color={mobileColors.accent} />
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
          disabled={accept.isPending || token.trim().length < 16}
          onPress={() => accept.mutate()}
        >
          <Text style={styles.ctaTxt}>
            {accept.isPending ? t("invite.validating") : t("invite.joinCta")}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: mobileColors.surface },
  content: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl,
    gap: mobileSpacing.md
  },
  previewLoading: {
    paddingVertical: mobileSpacing.xl,
    alignItems: "center"
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
    borderRadius: 24,
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
    fontSize: 13,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  intro: {
    ...mobileTypography.body,
    fontSize: 14,
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
    fontSize: 15,
    backgroundColor: mobileColors.background,
    minHeight: 88,
    textAlignVertical: "top",
    color: mobileColors.textPrimary
  },
  scanNote: {
    ...mobileTypography.body,
    fontSize: 14,
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
  ctaTxt: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
