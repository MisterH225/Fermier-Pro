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
import { CollaborativeAccessPanel } from "../account/CollaborativeAccessPanel";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";

type Props = {
  farmId: string | null;
  farmName: string | null;
};

export function InviteSection({ farmId, farmName }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const [confirmVisible, setConfirmVisible] = useState(false);

  const regenMut = useMutation({
    mutationFn: () =>
      regenerateFarmDefaultInvitation(accessToken, farmId!, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["farmDefaultInvitation", farmId, activeProfileId]
      });
      setConfirmVisible(false);
    },
    onError: (e: Error) => {
      setConfirmVisible(false);
      Alert.alert("", e.message);
    }
  });

  return (
    <View style={styles.wrap}>
      <CollaborativeAccessPanel farmId={farmId} farmName={farmName} />

      {farmId ? (
        <Pressable
          onPress={() => setConfirmVisible(true)}
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
      ) : null}

      <ConfirmDeleteModal
        visible={confirmVisible}
        title={t("collab.regenerateConfirmTitle")}
        body={t("collab.regenerateConfirmBody")}
        confirmLabel={t("collab.regenerateConfirmAction")}
        onConfirm={() => regenMut.mutate()}
        onCancel={() => setConfirmVisible(false)}
        loading={regenMut.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: mobileSpacing.sm
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
    backgroundColor: mobileColors.background,
    alignSelf: "center"
  },
  regenTxt: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  }
});
