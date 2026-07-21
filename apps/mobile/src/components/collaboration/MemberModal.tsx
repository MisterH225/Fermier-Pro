import { Ionicons } from "@expo/vector-icons";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../../context/SessionContext";
import type { FarmMemberDto, InvitationPermissions } from "../../lib/api";
import { patchFarmMember, removeFarmMember } from "../../lib/api";
import {
  ALL_PERMISSION_KEYS,
  type PermissionKey,
  ROLE_BADGE_COLOR,
  ROLE_DISPLAY_FR,
  permissionsToScopes,
  scopesToPermissions
} from "../../lib/memberPermissions";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { useModal } from "../modals/useModal";
import { BaseModal } from "./BaseModal";
import { MemberAvatar } from "./MemberAvatar";

type Props = {
  visible: boolean;
  member: FarmMemberDto | null;
  farmId: string;
  onClose: () => void;
};

export function MemberModal({ visible, member, farmId, onClose }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const { open } = useModal();

  const [editMode, setEditMode] = useState(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [permissions, setPermissions] = useState<InvitationPermissions>({});

  useEffect(() => {
    if (!visible) {
      setEditMode(false);
      setRevokeConfirmOpen(false);
    }
  }, [visible]);

  const startEdit = () => {
    if (!member) return;
    setPermissions(scopesToPermissions(member.scopes ?? []));
    setEditMode(true);
  };

  const togglePerm = (key: PermissionKey) => {
    setPermissions((prev) => {
      const next: InvitationPermissions = { ...prev, [key]: !prev[key] };
      const hasOther =
        Boolean(next.dataEntry) || Boolean(next.health) || Boolean(next.finance);
      if (!hasOther) next.readOnly = true;
      return next;
    });
  };

  const saveMut = useMutation({
    mutationFn: () =>
      patchFarmMember(
        accessToken,
        farmId,
        member!.id,
        { scopes: permissionsToScopes(permissions) },
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmMembers", farmId] });
      setEditMode(false);
      open("success", {
        message: t("collab.memberPermsSaved"),
        autoDismissMs: 2200
      });
      onClose();
    },
    onError: (e: Error) => Alert.alert(t("common.error"), e.message)
  });

  const revokeMut = useMutation({
    mutationFn: () =>
      removeFarmMember(accessToken, farmId, member!.id, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmMembers", farmId] });
      void qc.invalidateQueries({
        queryKey: ["farmPendingInvitations", farmId]
      });
      void qc.invalidateQueries({ queryKey: ["farmActivityLogs", farmId] });
      setRevokeConfirmOpen(false);
      onClose();
      setTimeout(() => {
        open("success", {
          message: t("collab.revokeSuccess"),
          autoDismissMs: 2200
        });
      }, 320);
    },
    onError: (e: Error) => {
      setRevokeConfirmOpen(false);
      Alert.alert(t("common.error"), e.message);
    }
  });

  if (!member) return null;

  const displayName =
    member.user.fullName?.trim() || member.user.email || "—";

  const badgeColor = ROLE_BADGE_COLOR[member.role] ?? mobileColors.textSecondary;
  const roleLabel = ROLE_DISPLAY_FR[member.role] ?? member.role;
  const currentPerms = scopesToPermissions(member.scopes ?? []);
  const isOwner = member.role === "owner";

  return (
    <BaseModal
      visible={visible}
      title={displayName}
      onClose={onClose}
      {...(editMode
        ? {
            confirmLabel: t("collab.savePermissions"),
            onConfirm: () => saveMut.mutate(),
            confirmLoading: saveMut.isPending
          }
        : {})}
    >
        {/* Avatar + Nom + Rôle */}
        <View style={styles.heroRow}>
          <MemberAvatar name={displayName} size={56} />
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{displayName}</Text>
            <View style={[styles.badge, { backgroundColor: `${badgeColor}18` }]}>
              <Text style={[styles.badgeTxt, { color: badgeColor }]}>
                {roleLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Permissions */}
        <Text style={styles.sectionLabel}>
          {t("collab.permissionsCurrentTitle")}
        </Text>

        <View style={styles.permList}>
          {ALL_PERMISSION_KEYS.map((key) => {
            const on = editMode
              ? Boolean(permissions[key])
              : Boolean(currentPerms[key]);
            return (
              <Pressable
                key={key}
                onPress={editMode ? () => togglePerm(key) : undefined}
                style={[
                  styles.permRow,
                  on && styles.permRowOn,
                  !editMode && styles.permRowReadonly
                ]}
                accessibilityRole={editMode ? "checkbox" : undefined}
                accessibilityState={editMode ? { checked: on } : undefined}
              >
                <View style={[styles.permTick, on && styles.permTickOn]}>
                  {on ? (
                    <Ionicons name="checkmark" size={14} color={mobileColors.onAccent} />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.permLabel,
                    on ? styles.permLabelOn : styles.permLabelOff
                  ]}
                >
                  {t(`collab.permissionKinds.${key}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {saveMut.isPending ? (
          <ActivityIndicator
            color={mobileColors.accent}
            style={styles.spinner}
          />
        ) : null}

        <View style={styles.divider} />

        {/* Actions */}
        {!isOwner && !editMode ? (
          <Pressable
            onPress={startEdit}
            style={styles.editBtn}
            accessibilityRole="button"
          >
            <Ionicons
              name="pencil-outline"
              size={16}
              color={mobileColors.accent}
            />
            <Text style={styles.editBtnTxt}>
              {t("collab.editPermissions")}
            </Text>
          </Pressable>
        ) : null}

        {!isOwner ? (
          revokeConfirmOpen ? (
            <View style={styles.revokeConfirmBox}>
              <Text style={styles.revokeConfirmTitle}>
                {t("collab.revokeConfirmTitle")}
              </Text>
              <Text style={styles.revokeConfirmBody}>
                {t("collab.revokeConfirmBody", { name: displayName })}
              </Text>
              <View style={styles.revokeConfirmRow}>
                <Pressable
                  onPress={() => setRevokeConfirmOpen(false)}
                  disabled={revokeMut.isPending}
                  style={[styles.revokeCancelBtn, revokeMut.isPending && styles.btnDisabled]}
                  accessibilityRole="button"
                >
                  <Text style={styles.revokeCancelTxt}>
                    {t("modals.confirmDelete.cancel")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => revokeMut.mutate()}
                  disabled={revokeMut.isPending}
                  style={[styles.revokeConfirmBtn, revokeMut.isPending && styles.btnDisabled]}
                  accessibilityRole="button"
                >
                  {revokeMut.isPending ? (
                    <ActivityIndicator color={mobileColors.onAccent} size="small" />
                  ) : (
                    <Text style={styles.revokeConfirmTxt}>
                      {t("collab.revokeConfirmAction")}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setRevokeConfirmOpen(true)}
              disabled={revokeMut.isPending}
              style={[styles.revokeBtn, revokeMut.isPending && styles.btnDisabled]}
              accessibilityRole="button"
            >
              <Ionicons name="ban-outline" size={16} color={mobileColors.error} />
              <Text style={styles.revokeBtnTxt}>{t("collab.revokeAccess")}</Text>
            </Pressable>
          )
        ) : null}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    marginBottom: mobileSpacing.md
  },
  heroInfo: { gap: mobileSpacing.xs },
  heroName: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  badge: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 3,
    borderRadius: mobileRadius.pill,
    alignSelf: "flex-start"
  },
  badgeTxt: {
    fontSize: mobileFontSize.sm,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: mobileColors.border,
    marginVertical: mobileSpacing.md
  },
  sectionLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: mobileSpacing.sm
  },
  permList: {
    gap: mobileSpacing.xs
  },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: mobileSpacing.sm,
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
  permRowReadonly: {
    opacity: 0.9
  },
  permTick: {
    width: 20,
    height: 20,
    borderRadius: mobileRadius.sm,
    borderWidth: 1.5,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background,
    marginRight: mobileSpacing.sm,
    alignItems: "center",
    justifyContent: "center"
  },
  permTickOn: {
    backgroundColor: mobileColors.accent,
    borderColor: mobileColors.accent
  },
  permLabel: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.md
  },
  permLabelOn: {
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  permLabelOff: {
    color: mobileColors.textSecondary
  },
  spinner: { marginTop: mobileSpacing.sm },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs,
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft,
    marginBottom: mobileSpacing.sm
  },
  editBtnTxt: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  revokeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs,
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.error
  },
  revokeBtnTxt: {
    ...mobileTypography.body,
    color: mobileColors.error,
    fontWeight: "600"
  },
  btnDisabled: {
    opacity: 0.5
  },
  revokeConfirmBox: {
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.error,
    backgroundColor: "rgba(214, 69, 69, 0.06)",
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  revokeConfirmTitle: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.lg,
    color: mobileColors.error
  },
  revokeConfirmBody: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary
  },
  revokeConfirmRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.xs
  },
  revokeCancelBtn: {
    flex: 1,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    alignItems: "center"
  },
  revokeCancelTxt: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  revokeConfirmBtn: {
    flex: 1,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.error,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  revokeConfirmTxt: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.onAccent
  }
});
