import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { FarmInvitationChatPayload } from "../../lib/farmInvitationMessage";
import { useSession } from "../../context/SessionContext";
import { respondToMyInvitation } from "../../lib/api";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  payload: FarmInvitationChatPayload;
  isMine: boolean;
};

export function InviteCardInChat({ payload, isMine }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const [status, setStatus] = useState(payload.status);

  useEffect(() => {
    setStatus(payload.status);
  }, [payload.invitationId, payload.status]);

  const respondMut = useMutation({
    mutationFn: (accept: boolean) =>
      respondToMyInvitation(
        accessToken!,
        payload.invitationId,
        accept,
        activeProfileId
      ),
    onSuccess: (_, accept) => {
      setStatus(accept ? "accepted" : "rejected");
      void qc.invalidateQueries({ queryKey: ["chatMessages"] });
      void qc.invalidateQueries({ queryKey: ["myPendingInvitations"] });
    },
    onError: (e: Error) => {
      Alert.alert(t("collab.directory.inviteModalTitle"), getUserFacingError(e, t));
    }
  });

  const statusLabel =
    status === "accepted"
      ? t("collab.directory.inviteAccepted")
      : status === "rejected"
        ? t("collab.directory.inviteRejected")
        : t("collab.directory.invitePending");

  return (
    <View style={[styles.wrap, isMine ? styles.wrapMine : styles.wrapOther]}>
      <Text style={styles.icon}>🏡</Text>
      <Text style={styles.title}>{t("collab.directory.inviteCardTitle")}</Text>
      <Text style={styles.farm}>{payload.farmName}</Text>
      <Text style={styles.role}>
        {t("collab.directory.inviteCardRole", { role: payload.roleLabel })}
      </Text>
      <Text style={styles.status}>{statusLabel}</Text>
      {!isMine && status === "pending" ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnAccept]}
            onPress={() => respondMut.mutate(true)}
            disabled={respondMut.isPending}
          >
            <Text style={styles.btnTxAccept}>✅ Accepter</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnDecline]}
            onPress={() => respondMut.mutate(false)}
            disabled={respondMut.isPending}
          >
            <Text style={styles.btnTxDecline}>❌ Décliner</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: "92%",
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    marginVertical: mobileSpacing.sm,
    borderWidth: 1,
    borderColor: mobileColors.accent
  },
  wrapMine: {
    alignSelf: "flex-end",
    backgroundColor: mobileColors.accentSoft
  },
  wrapOther: {
    alignSelf: "flex-start",
    backgroundColor: mobileColors.background
  },
  icon: { fontSize: 24, marginBottom: 4 },
  title: { fontWeight: "800", fontSize: 14, color: mobileColors.textPrimary },
  farm: {
    ...mobileTypography.body,
    fontWeight: "700",
    marginTop: 4
  },
  role: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  status: {
    ...mobileTypography.meta,
    marginTop: 8,
    fontStyle: "italic"
  },
  actions: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.md
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    alignItems: "center"
  },
  btnAccept: { backgroundColor: mobileColors.accent },
  btnDecline: {
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  btnTxAccept: { color: mobileColors.onAccent, fontWeight: "700", fontSize: 13 },
  btnTxDecline: { color: mobileColors.textPrimary, fontWeight: "600", fontSize: 13 }
});
