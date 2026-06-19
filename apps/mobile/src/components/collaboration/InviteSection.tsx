import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../../context/SessionContext";
import { regenerateFarmDefaultInvitation } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { useModal } from "../modals/useModal";
import { CollaborativeAccessPanel } from "../account/CollaborativeAccessPanel";
import { PendingScanRequestsSection } from "./PendingScanRequestsSection";
import { SearchCollaboratorModal } from "./SearchCollaboratorModal";

type Props = {
  farmId: string | null;
  farmName: string | null;
  canManageInvites: boolean;
};

export function InviteSection({ farmId, farmName, canManageInvites }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const { open } = useModal();
  const [searchVisible, setSearchVisible] = useState(false);

  const regenMut = useMutation({
    mutationFn: () =>
      regenerateFarmDefaultInvitation(accessToken, farmId!, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["farmDefaultInvitation", farmId, activeProfileId]
      });
    },
    onError: (e: Error) => {
      Alert.alert("", e.message);
    }
  });

  const openRegenConfirm = () => {
    open("confirm-delete", {
      title: t("collab.regenerateConfirmTitle"),
      message: t("collab.regenerateConfirmBody"),
      confirmLabel: t("collab.regenerateConfirmAction"),
      onConfirm: async () => { await regenMut.mutateAsync(); }
    });
  };

  return (
    <View style={styles.wrap}>
      {!canManageInvites ? (
        <Text style={styles.readOnlyNote}>{t("collab.invitesReadOnly")}</Text>
      ) : null}

      {canManageInvites && farmId ? (
        <PendingScanRequestsSection farmId={farmId} />
      ) : null}

      {canManageInvites ? (
        <CollaborativeAccessPanel farmId={farmId} farmName={farmName} />
      ) : null}

      {canManageInvites && farmId ? (
        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => setSearchVisible(true)}
            style={styles.addBtn}
            accessibilityRole="button"
            accessibilityLabel={t("collab.searchByIdentifier.openBtn")}
          >
            <Ionicons
              name="person-add-outline"
              size={16}
              color={mobileColors.accent}
            />
            <Text style={styles.addBtnTxt}>
              {t("collab.searchByIdentifier.openBtn")}
            </Text>
          </Pressable>

          <Pressable
            onPress={openRegenConfirm}
            style={styles.regenBtn}
            accessibilityRole="button"
          >
            <Ionicons
              name="refresh-outline"
              size={16}
              color={mobileColors.textSecondary}
            />
            <Text style={styles.regenTxt}>{t("collab.regenerateLink")}</Text>
          </Pressable>
        </View>
      ) : null}

      {canManageInvites ? (
        <SearchCollaboratorModal
          visible={searchVisible}
          farmId={farmId}
          onClose={() => setSearchVisible(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: mobileSpacing.sm
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.background
  },
  addBtnTxt: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  regenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  regenTxt: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  readOnlyNote: {
    ...mobileTypography.body,
    fontSize: 14,
    color: mobileColors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: mobileSpacing.sm
  }
});
