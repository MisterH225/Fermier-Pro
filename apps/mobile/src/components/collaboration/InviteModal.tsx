import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import {
  buildInvitationShareUrl,
  createFarmInvitation,
  type InvitationPermissions,
  type InvitationRecipientKind
} from "../../lib/api";
import { isDemoBypassToken } from "../../lib/demoBypass";
import {
  ALL_PERMISSION_KEYS,
  type PermissionKey
} from "../../lib/memberPermissions";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { BaseModal } from "./BaseModal";
import { SuccessModal } from "./SuccessModal";

type RecipientOption = {
  key: InvitationRecipientKind;
  icon: keyof typeof Ionicons.glyphMap;
};

const RECIPIENT_OPTIONS: RecipientOption[] = [
  { key: "veterinarian", icon: "medkit-outline" },
  { key: "technician", icon: "construct-outline" },
  { key: "partner", icon: "people-outline" }
];

function defaultPermissionsFor(kind: InvitationRecipientKind): InvitationPermissions {
  switch (kind) {
    case "veterinarian":
      return { readOnly: true, health: true };
    case "technician":
      return { readOnly: true, dataEntry: true };
    default:
      return { readOnly: true };
  }
}

type Props = {
  visible: boolean;
  farmId: string | null;
  farmName: string | null;
  onClose: () => void;
};

export function InviteModal({ visible, farmId, farmName, onClose }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const [recipientKind, setRecipientKind] =
    useState<InvitationRecipientKind>("technician");
  const [permissions, setPermissions] = useState<InvitationPermissions>(
    defaultPermissionsFor("technician")
  );
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const pickRecipient = (kind: InvitationRecipientKind) => {
    setRecipientKind(kind);
    setPermissions(defaultPermissionsFor(kind));
  };

  const togglePermission = (key: PermissionKey) => {
    setPermissions((prev) => {
      const next: InvitationPermissions = { ...prev, [key]: !prev[key] };
      const hasOther =
        Boolean(next.dataEntry) || Boolean(next.health) || Boolean(next.finance);
      if (!hasOther) next.readOnly = true;
      return next;
    });
  };

  const submit = async () => {
    if (!farmId) return;
    if (isDemoBypassToken(accessToken)) {
      Alert.alert("", t("collab.demoBlocked"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await createFarmInvitation(
        accessToken,
        farmId,
        { recipientKind, permissions },
        activeProfileId
      );
      const url = buildInvitationShareUrl(res.token);
      const message = t("collab.shareMessage", {
        farm: farmName ?? "",
        url
      });
      await Share.share({ message, url });
      setSuccess(true);
    } catch (e) {
      Alert.alert("", e instanceof Error ? e.message : t("collab.createError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    onClose();
  };

  return (
    <>
      <BaseModal
        visible={visible && !success}
        title={t("collab.shareTitle")}
        onClose={handleClose}
        confirmLabel={t("collab.shareConfirm")}
        onConfirm={() => void submit()}
        confirmDisabled={!farmId}
        confirmLoading={submitting}
      >
        <Text style={styles.label}>{t("collab.fieldRecipient")}</Text>
        <View style={styles.recipientGrid}>
          {RECIPIENT_OPTIONS.map((opt) => {
            const selected = opt.key === recipientKind;
            return (
              <Pressable
                key={opt.key}
                onPress={() => pickRecipient(opt.key)}
                style={[styles.recipientCard, selected && styles.recipientCardOn]}
                accessibilityRole="button"
                accessibilityLabel={t(`collab.recipientKinds.${opt.key}`)}
              >
                <Ionicons
                  name={opt.icon}
                  size={28}
                  color={selected ? mobileColors.accent : mobileColors.textSecondary}
                />
                <Text
                  style={[
                    styles.recipientLabel,
                    selected && styles.recipientLabelOn
                  ]}
                >
                  {t(`collab.recipientKinds.${opt.key}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, styles.labelGap]}>
          {t("collab.fieldPermissions")}
        </Text>
        <Text style={styles.hint}>{t("collab.permissionsHint")}</Text>
        <View style={styles.permList}>
          {ALL_PERMISSION_KEYS.map((key) => {
            const on = Boolean(permissions[key]);
            return (
              <Pressable
                key={key}
                onPress={() => togglePermission(key)}
                style={[styles.permRow, on && styles.permRowOn]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t(`collab.permissionKinds.${key}`)}
              >
                <View style={[styles.permTick, on && styles.permTickOn]}>
                  {on ? (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  ) : null}
                </View>
                <View style={styles.permTexts}>
                  <Text style={styles.permTitle}>
                    {t(`collab.permissionKinds.${key}`)}
                  </Text>
                  <Text style={styles.permSub}>
                    {t(`collab.permissionHints.${key}`)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {submitting ? (
          <ActivityIndicator
            color={mobileColors.accent}
            style={styles.spinner}
          />
        ) : null}

        <Text style={styles.footerHint}>{t("collab.shareFooterHint")}</Text>
      </BaseModal>

      <SuccessModal
        visible={success}
        message={t("collab.inviteSent")}
        onClose={handleClose}
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: mobileSpacing.sm
  },
  labelGap: {
    marginTop: mobileSpacing.xl
  },
  recipientGrid: {
    flexDirection: "row",
    gap: mobileSpacing.sm
  },
  recipientCard: {
    flex: 1,
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.surfaceMuted,
    minHeight: 92,
    gap: 6
  },
  recipientCardOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  recipientLabel: {
    ...mobileTypography.body,
    fontSize: 12,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  recipientLabelOn: {
    color: mobileColors.accent,
    fontWeight: "600"
  },
  hint: {
    ...mobileTypography.meta,
    fontSize: 12,
    lineHeight: 17,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  permList: {
    gap: mobileSpacing.xs
  },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.surfaceMuted
  },
  permRowOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  permTick: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background,
    marginRight: mobileSpacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  permTickOn: {
    backgroundColor: mobileColors.accent,
    borderColor: mobileColors.accent
  },
  permTexts: { flex: 1 },
  permTitle: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  permSub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  spinner: {
    marginTop: mobileSpacing.md
  },
  footerHint: {
    ...mobileTypography.meta,
    fontSize: 12,
    lineHeight: 17,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xl
  }
});
