import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  inviteCollaboratorByIdentifier,
  inviteCollaboratorFromChat,
  type InvitationPermissions,
  type InvitationRecipientKind
} from "../../lib/api";
import {
  ALL_PERMISSION_KEYS,
  type PermissionKey
} from "../../lib/memberPermissions";
import { useSession } from "../../context/SessionContext";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";
import { mobileColors, mobileSpacing, mobileTypography, mobileRadius } from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  farmId: string;
  farmName: string;
  peerUserId: string;
  peerDisplayName: string;
  recipientKind: InvitationRecipientKind;
  roomId?: string;
  onClose: () => void;
  onSuccess?: (roomId: string) => void;
};

function defaultPermissions(kind: InvitationRecipientKind): InvitationPermissions {
  if (kind === "veterinarian") {
    return { readOnly: true, dataEntry: true, health: true };
  }
  if (kind === "technician") {
    return { readOnly: true, dataEntry: true };
  }
  return { readOnly: true };
}

export function DirectInviteModal({
  visible,
  farmId,
  farmName,
  peerUserId,
  peerDisplayName,
  recipientKind,
  roomId,
  onClose,
  onSuccess
}: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const [permissions, setPermissions] = useState<InvitationPermissions>(
    defaultPermissions(recipientKind)
  );
  const [message, setMessage] = useState("");

  const togglePerm = (key: PermissionKey) => {
    setPermissions((p) => ({ ...p, [key]: !p[key] }));
  };

  const sendMut = useMutation({
    mutationFn: () => {
      const payload = {
        peerUserId,
        recipientKind,
        permissions,
        message: message.trim() || undefined,
        roomId
      };
      if (roomId) {
        return inviteCollaboratorFromChat(
          accessToken!,
          farmId,
          payload,
          activeProfileId
        );
      }
      return inviteCollaboratorByIdentifier(
        accessToken!,
        farmId,
        {
          userId: peerUserId,
          recipientKind,
          permissions,
          message: message.trim() || undefined
        },
        activeProfileId
      ).then((r) => ({ ...r, roomId: roomId ?? "", messageId: "" }));
    },
    onSuccess: (data) => {
      onClose();
      onSuccess?.(data.roomId);
      Alert.alert(
        t("collab.directory.inviteSentTitle"),
        t("collab.directory.inviteSentBody", { name: peerDisplayName, farm: farmName })
      );
    },
    onError: (e: Error) => {
      Alert.alert(t("collab.directory.inviteErrorTitle"), getUserFacingError(e, t));
    }
  });

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("collab.directory.inviteModalTitle")}
      footerPrimary={
        <PrimaryButton
          label={t("collab.directory.inviteSend")}
          onPress={() => sendMut.mutate()}
          loading={sendMut.isPending}
        />
      }
    >
      <Text style={styles.sub}>
        {peerDisplayName} · {farmName}
      </Text>
      <Text style={styles.label}>{t("collab.directory.permissions")}</Text>
      {ALL_PERMISSION_KEYS.map((key) => (
        <Text
          key={key}
          style={styles.permRow}
          onPress={() => togglePerm(key)}
        >
          {(permissions[key] ? "☑" : "☐") +
            " " +
            t(`collab.permissionKinds.${key}`)}
        </Text>
      ))}
      <Text style={styles.label}>{t("collab.directory.inviteMessage")}</Text>
      <TextInput
        style={styles.input}
        value={message}
        onChangeText={setMessage}
        placeholder={t("collab.directory.inviteMessagePh")}
        multiline
      />
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  sub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  label: {
    ...mobileTypography.meta,
    fontWeight: "700",
    marginBottom: mobileSpacing.xs,
    marginTop: mobileSpacing.sm
  },
  permRow: {
    ...mobileTypography.body,
    paddingVertical: 6
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top"
  }
});
