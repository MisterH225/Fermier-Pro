import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useSession } from "../../context/SessionContext";
import {
  respondToInvitation,
  type FarmInvitationPendingDto,
  type InvitationPermissions,
  type InvitationRecipientKind
} from "../../lib/api";
import {
  defaultPermissionsForRecipientKind,
  recipientKindToMembershipRole
} from "../../lib/memberPermissions";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { useModal } from "../modals/useModal";
import { getUserFacingError } from "../../lib/userFacingError";
import { BaseModal } from "./BaseModal";
import { CollaboratorRolePermissionsFields } from "./CollaboratorRolePermissionsFields";

type Props = {
  visible: boolean;
  invitation: FarmInvitationPendingDto | null;
  farmId: string;
  onClose: () => void;
};

export function RespondScanRequestModal({
  visible,
  invitation,
  farmId,
  onClose
}: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const modal = useModal();

  const [recipientKind, setRecipientKind] =
    useState<InvitationRecipientKind>("technician");
  const [permissions, setPermissions] = useState<InvitationPermissions>(
    defaultPermissionsForRecipientKind("technician")
  );
  useEffect(() => {
    if (!visible || !invitation) return;
    setRecipientKind("technician");
    setPermissions(defaultPermissionsForRecipientKind("technician"));
  }, [visible, invitation?.id]);

  const invalidate = () => {
    void qc.invalidateQueries({
      queryKey: ["farmPendingInvitations", farmId, activeProfileId]
    });
    void qc.invalidateQueries({ queryKey: ["farmPendingInvitations", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmMembers", farmId] });
  };

  const acceptMut = useMutation({
    mutationFn: () =>
      respondToInvitation(
        accessToken,
        invitation!.id,
        {
          accept: true,
          recipientRole: recipientKindToMembershipRole(recipientKind),
          permissions
        },
        activeProfileId
      ),
    onSuccess: () => {
      invalidate();
      modal.open("success", {
        message: t("collab.scanRequests.acceptedToast"),
        autoDismissMs: 2200
      });
      onClose();
    },
    onError: (e: Error) => Alert.alert("", getUserFacingError(e, t))
  });

  const rejectMut = useMutation({
    mutationFn: () =>
      respondToInvitation(
        accessToken,
        invitation!.id,
        { accept: false },
        activeProfileId
      ),
    onSuccess: () => {
      invalidate();
      modal.open("success", {
        message: t("collab.scanRequests.rejectedToast"),
        autoDismissMs: 2200
      });
      onClose();
    },
    onError: (e: Error) => Alert.alert("", getUserFacingError(e, t))
  });

  const requesterLabel = invitation?.scannedBy?.fullName?.trim()
    || invitation?.scannedBy?.email?.trim()
    || invitation?.scannedBy?.phone?.trim()
    || t("collab.scanRequests.requestFromUnknown");

  const confirmReject = () => {
    Alert.alert(
      t("collab.scanRequests.rejectConfirmTitle"),
      t("collab.scanRequests.rejectConfirmBody", { name: requesterLabel }),
      [
        { text: t("collab.pendingInvitations.cancel"), style: "cancel" },
        {
          text: t("collab.scanRequests.reject"),
          style: "destructive",
          onPress: () => rejectMut.mutate()
        }
      ]
    );
  };

  const busy = acceptMut.isPending || rejectMut.isPending;

  return (
    <>
      <BaseModal
        visible={visible}
        title={t("collab.scanRequests.modalTitle")}
        onClose={onClose}
        confirmLabel={t("collab.scanRequests.accept")}
        onConfirm={() => acceptMut.mutate()}
        confirmDisabled={!invitation || busy}
        confirmLoading={acceptMut.isPending}
        dangerLabel={t("collab.scanRequests.reject")}
        onDanger={confirmReject}
      >
        {invitation ? (
          <>
            <View style={styles.requesterBox}>
              <View style={styles.requesterIcon}>
                <Ionicons name="qr-code-outline" size={22} color={mobileColors.accent} />
              </View>
              <View style={styles.requesterTexts}>
                <Text style={styles.requesterTitle}>
                  {t("collab.scanRequests.requestFrom", { name: requesterLabel })}
                </Text>
                <Text style={styles.requesterMeta}>
                  {t("collab.scanRequests.expires", {
                    date: new Date(invitation.expiresAt).toLocaleDateString()
                  })}
                </Text>
              </View>
            </View>

            <Text style={styles.configureHint}>
              {t("collab.scanRequests.configureHint")}
            </Text>

            <CollaboratorRolePermissionsFields
              recipientKind={recipientKind}
              permissions={permissions}
              onRecipientKindChange={setRecipientKind}
              onPermissionsChange={setPermissions}
            />
          </>
        ) : null}
      </BaseModal>
    </>
  );
}

const styles = StyleSheet.create({
  requesterBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accentSoft,
    marginBottom: mobileSpacing.lg
  },
  requesterIcon: {
    width: 44,
    height: 44,
    borderRadius: mobileRadius.xl,
    backgroundColor: mobileColors.background,
    alignItems: "center",
    justifyContent: "center"
  },
  requesterTexts: { flex: 1, minWidth: 0 },
  requesterTitle: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "700"
  },
  requesterMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  configureHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    lineHeight: 18,
    marginBottom: mobileSpacing.lg
  }
});
