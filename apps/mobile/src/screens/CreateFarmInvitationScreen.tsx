import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { CollaboratorRolePermissionsFields } from "../components/collaboration/CollaboratorRolePermissionsFields";
import { PhoneInput } from "../components/PhoneInput";
import { useScreenTitle } from "../hooks/useScreenTitle";
import { useSession } from "../context/SessionContext";
import {
  buildInvitationShareUrl,
  createFarmInvitation,
  type InvitationPermissions,
  type InvitationRecipientKind
} from "../lib/api";
import { defaultPermissionsForRecipientKind } from "../lib/memberPermissions";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";
import { getQueryErrorMessage, getUserFacingError } from "../lib/userFacingError";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "CreateFarmInvitation"
>;

export function CreateFarmInvitationScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { t } = useTranslation();
  useScreenTitle(navigation, t("navigation.screenTitles.invite"));
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();

  const [recipientKind, setRecipientKind] =
    useState<InvitationRecipientKind>("technician");
  const [permissions, setPermissions] = useState<InvitationPermissions>(
    defaultPermissionsForRecipientKind("technician")
  );
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      createFarmInvitation(
        accessToken,
        farmId,
        {
          recipientKind,
          permissions,
          inviteeEmail: email.trim() || undefined,
          inviteePhone: phone.trim() || undefined
        },
        activeProfileId
      ),
    onSuccess: async (res) => {
      void qc.invalidateQueries({
        queryKey: ["farmPendingInvitations", farmId]
      });
      const url = buildInvitationShareUrl(res.token);
      const message = t("collab.shareMessage", {
        farm: farmName ?? "",
        url
      });
      try {
        await Share.share({ message, url });
      } catch {
        // Partage annulé ou indisponible — on affiche quand même la confirmation.
      }
      Alert.alert(t("collab.inviteSent"), url, [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    },
    onError: (e: Error) => Alert.alert(t("common.error"), getUserFacingError(e, t))
  });

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <CollaboratorRolePermissionsFields
        recipientKind={recipientKind}
        permissions={permissions}
        onRecipientKindChange={setRecipientKind}
        onPermissionsChange={setPermissions}
      />

      <Text style={[styles.label, styles.labelGap]}>
        {t("collab.createInvitation.emailLabel")}
      </Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder={t("collab.createInvitation.emailPlaceholder")}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Text style={styles.label}>
        {t("collab.createInvitation.phoneLabel")}
      </Text>
      <PhoneInput
        value={phone}
        onChange={setPhone}
        placeholder={t("collab.createInvitation.phonePlaceholder")}
        showHint
      />
      <Text style={styles.note}>{t("collab.createInvitation.note")}</Text>

      <TouchableOpacity
        style={[styles.cta, mut.isPending && styles.ctaDisabled]}
        disabled={mut.isPending}
        onPress={() => mut.mutate()}
      >
        <Text style={styles.ctaTxt}>
          {mut.isPending
            ? t("collab.createInvitation.submitting")
            : t("collab.createInvitation.submit")}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: mobileColors.background },
  content: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: mobileSpacing.sm,
    marginTop: mobileSpacing.md
  },
  labelGap: {
    marginTop: mobileSpacing.xl
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm + 2,
    fontSize: mobileFontSize.lg,
    backgroundColor: mobileColors.surfaceMuted,
    color: mobileColors.textPrimary
  },
  note: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.md,
    lineHeight: 18
  },
  cta: {
    marginTop: mobileSpacing.xl,
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    padding: mobileSpacing.md,
    alignItems: "center"
  },
  ctaDisabled: { opacity: 0.6 },
  ctaTxt: {
    color: mobileColors.onAccent,
    fontWeight: "700",
    fontSize: mobileFontSize.lg
  }
});
