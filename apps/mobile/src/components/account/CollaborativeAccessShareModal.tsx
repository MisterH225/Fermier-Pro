import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../context/SessionContext";
import {
  buildInvitationShareUrl,
  createFarmInvitation,
  type InvitationPermissions,
  type InvitationRecipientKind
} from "../../lib/api";
import { isDemoBypassToken } from "../../lib/demoBypass";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  farmId: string | null;
  farmName: string | null;
  onClose: () => void;
};

type RecipientOption = {
  key: InvitationRecipientKind;
  icon: keyof typeof Ionicons.glyphMap;
};

const RECIPIENT_OPTIONS: RecipientOption[] = [
  { key: "veterinarian", icon: "medkit-outline" },
  { key: "technician", icon: "construct-outline" },
  { key: "partner", icon: "people-outline" }
];

type PermissionKey = keyof InvitationPermissions;

const PERMISSION_KEYS: readonly PermissionKey[] = [
  "readOnly",
  "dataEntry",
  "health",
  "finance"
] as const;

function defaultPermissionsFor(kind: InvitationRecipientKind): InvitationPermissions {
  switch (kind) {
    case "veterinarian":
      return { readOnly: true, health: true };
    case "technician":
      return { readOnly: true, dataEntry: true };
    case "partner":
      return { readOnly: true };
    default:
      return { readOnly: true };
  }
}

export function CollaborativeAccessShareModal({
  visible,
  farmId,
  farmName,
  onClose
}: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const [recipientKind, setRecipientKind] =
    useState<InvitationRecipientKind>("technician");
  const [permissions, setPermissions] = useState<InvitationPermissions>(
    defaultPermissionsFor("technician")
  );
  const [submitting, setSubmitting] = useState(false);

  const pickRecipient = (kind: InvitationRecipientKind) => {
    setRecipientKind(kind);
    setPermissions(defaultPermissionsFor(kind));
  };

  const togglePermission = (key: PermissionKey) => {
    setPermissions((prev) => {
      const next: InvitationPermissions = { ...prev, [key]: !prev[key] };
      // « readOnly » seul si rien d'autre n'est activé.
      const hasOther =
        Boolean(next.dataEntry) ||
        Boolean(next.health) ||
        Boolean(next.finance);
      if (!hasOther) {
        next.readOnly = true;
      }
      return next;
    });
  };

  const submit = async () => {
    if (!farmId) {
      return;
    }
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
      onClose();
      const message = t("collab.shareMessage", {
        farm: farmName ?? "",
        url
      });
      await Share.share({ message, url });
    } catch (e) {
      Alert.alert(
        "",
        e instanceof Error ? e.message : t("collab.createError")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel={t("collab.shareCancel")}
          >
            <Text style={styles.topBarCancel}>{t("collab.shareCancel")}</Text>
          </Pressable>
          <Text style={styles.topBarTitle}>{t("collab.shareTitle")}</Text>
          <Pressable
            onPress={() => void submit()}
            disabled={submitting || !farmId}
            hitSlop={14}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={mobileColors.accent} />
            ) : (
              <Text style={styles.topBarConfirm}>
                {t("collab.shareConfirm")}
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.label}>{t("collab.fieldRecipient")}</Text>
          <View style={styles.recipientGrid}>
            {RECIPIENT_OPTIONS.map((opt) => {
              const selected = opt.key === recipientKind;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => pickRecipient(opt.key)}
                  style={[
                    styles.recipientCard,
                    selected && styles.recipientCardOn
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t(`collab.recipientKinds.${opt.key}`)}
                >
                  <Ionicons
                    name={opt.icon}
                    size={28}
                    color={
                      selected
                        ? mobileColors.accent
                        : mobileColors.textSecondary
                    }
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
            {PERMISSION_KEYS.map((key) => {
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

          <Text style={[styles.hint, styles.bottomHint]}>
            {t("collab.shareFooterHint")}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm
  },
  topBarTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  topBarCancel: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  },
  topBarConfirm: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  scroll: {
    paddingHorizontal: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: mobileSpacing.md,
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
    fontSize: 13,
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
  bottomHint: {
    marginTop: mobileSpacing.xl
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
  permTexts: {
    flex: 1
  },
  permTitle: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  permSub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  }
});
