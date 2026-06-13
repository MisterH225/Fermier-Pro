import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type {
  InvitationPermissions,
  InvitationRecipientKind
} from "../../lib/api";
import {
  ALL_PERMISSION_KEYS,
  defaultPermissionsForRecipientKind,
  toggleInvitationPermission,
  type PermissionKey
} from "../../lib/memberPermissions";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type RecipientOption = {
  key: InvitationRecipientKind;
  icon: keyof typeof Ionicons.glyphMap;
};

export const COLLABORATOR_RECIPIENT_OPTIONS: RecipientOption[] = [
  { key: "veterinarian", icon: "medkit-outline" },
  { key: "technician", icon: "construct-outline" },
  { key: "partner", icon: "people-outline" }
];

type Props = {
  recipientKind: InvitationRecipientKind;
  permissions: InvitationPermissions;
  onRecipientKindChange: (kind: InvitationRecipientKind) => void;
  onPermissionsChange: (permissions: InvitationPermissions) => void;
};

export function CollaboratorRolePermissionsFields({
  recipientKind,
  permissions,
  onRecipientKindChange,
  onPermissionsChange
}: Props) {
  const { t } = useTranslation();

  const pickRecipient = (kind: InvitationRecipientKind) => {
    onRecipientKindChange(kind);
    onPermissionsChange(defaultPermissionsForRecipientKind(kind));
  };

  const togglePermission = (key: PermissionKey) => {
    onPermissionsChange(toggleInvitationPermission(permissions, key));
  };

  return (
    <>
      <Text style={styles.label}>{t("collab.fieldRecipient")}</Text>
      <View style={styles.recipientGrid}>
        {COLLABORATOR_RECIPIENT_OPTIONS.map((opt) => {
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
                  <Ionicons name="checkmark" size={16} color={mobileColors.onAccent} />
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
  }
});
