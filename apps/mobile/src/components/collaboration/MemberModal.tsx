import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
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
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { BaseModal } from "./BaseModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { MemberAvatar } from "./MemberAvatar";
import { SuccessModal } from "./SuccessModal";

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

  const [editMode, setEditMode] = useState(false);
  const [permissions, setPermissions] = useState<InvitationPermissions>({});
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

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
      setSuccessMsg(t("collab.memberPermsSaved"));
      setShowSuccess(true);
    },
    onError: (e: Error) => Alert.alert("", e.message)
  });

  const revokeMut = useMutation({
    mutationFn: () =>
      removeFarmMember(accessToken, farmId, member!.id, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmMembers", farmId] });
      setConfirmRevoke(false);
      onClose();
    },
    onError: (e: Error) => {
      setConfirmRevoke(false);
      Alert.alert("", e.message);
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
    <>
      <BaseModal
        visible={visible && !confirmRevoke && !showSuccess}
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
                    <Ionicons name="checkmark" size={14} color="#fff" />
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
          <Pressable
            onPress={() => setConfirmRevoke(true)}
            style={styles.revokeBtn}
            accessibilityRole="button"
          >
            <Ionicons name="ban-outline" size={16} color={mobileColors.error} />
            <Text style={styles.revokeBtnTxt}>{t("collab.revokeAccess")}</Text>
          </Pressable>
        ) : null}
      </BaseModal>

      <ConfirmDeleteModal
        visible={confirmRevoke}
        title={t("collab.revokeConfirmTitle")}
        body={t("collab.revokeConfirmBody", { name: displayName })}
        confirmLabel={t("collab.revokeConfirmAction")}
        onConfirm={() => revokeMut.mutate()}
        onCancel={() => setConfirmRevoke(false)}
        loading={revokeMut.isPending}
      />

      <SuccessModal
        visible={showSuccess}
        message={successMsg}
        onClose={() => setShowSuccess(false)}
      />
    </>
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
    fontSize: 12,
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
    borderRadius: 5,
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
    fontSize: 14
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
  }
});
