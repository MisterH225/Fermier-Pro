import { Ionicons } from "@expo/vector-icons";
import { getQueryErrorMessage, getUserFacingError } from "../../lib/userFacingError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../context/SessionContext";
import {
  fetchMyPendingInvitations,
  respondToMyInvitation,
  type MyPendingInvitationDto
} from "../../lib/api";
import { ROLE_DISPLAY_FR } from "../../lib/memberPermissions";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function PendingInvitationsModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["myPendingInvitations", activeProfileId],
    queryFn: () => fetchMyPendingInvitations(accessToken, activeProfileId),
    enabled: visible && Boolean(accessToken)
  });

  const respondMut = useMutation({
    mutationFn: async (input: { invitationId: string; accept: boolean }) =>
      respondToMyInvitation(
        accessToken,
        input.invitationId,
        input.accept,
        activeProfileId
      ),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({
        queryKey: ["myPendingInvitations", activeProfileId]
      });
      void qc.invalidateQueries({
        queryKey: ["myPendingInvitations.banner", activeProfileId]
      });
      void qc.invalidateQueries({ queryKey: ["farms", activeProfileId] });
      void qc.invalidateQueries({ queryKey: ["farm"] });
      void qc.invalidateQueries({ queryKey: ["farmMembers"] });
      if (vars.accept) {
        Alert.alert("", t("collab.pendingInvitations.acceptedToast"));
      }
    },
    onError: (e: Error) => Alert.alert(t("common.error"), getUserFacingError(e, t))
  });

  const items = listQuery.data ?? [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityRole="button"
          >
            <Ionicons
              name="close"
              size={24}
              color={mobileColors.textSecondary}
            />
          </Pressable>
          <Text style={styles.title}>
            {t("collab.pendingInvitations.title")}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        {listQuery.isLoading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={mobileColors.accent} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name="mail-open-outline"
              size={40}
              color={mobileColors.textSecondary}
            />
            <Text style={styles.emptyTxt}>
              {t("collab.pendingInvitations.empty")}
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            renderItem={({ item }) => (
              <InvitationRow
                item={item}
                disabled={respondMut.isPending}
                onAccept={() =>
                  respondMut.mutate({
                    invitationId: item.id,
                    accept: true
                  })
                }
                onReject={() =>
                  Alert.alert(
                    t("collab.pendingInvitations.confirmRejectTitle"),
                    t("collab.pendingInvitations.confirmRejectBody", {
                      farm: item.farmName
                    }),
                    [
                      { text: t("collab.pendingInvitations.cancel") },
                      {
                        text: t("collab.pendingInvitations.reject"),
                        style: "destructive",
                        onPress: () =>
                          respondMut.mutate({
                            invitationId: item.id,
                            accept: false
                          })
                      }
                    ]
                  )
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function InvitationRow({
  item,
  onAccept,
  onReject,
  disabled
}: {
  item: MyPendingInvitationDto;
  onAccept: () => void;
  onReject: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const roleLabel = item.role
    ? (ROLE_DISPLAY_FR[item.role] ?? item.role)
    : t("collab.pendingInvitations.roleUnknown");

  const permList: string[] = [];
  const perms = item.permissions;
  if (perms?.readOnly) permList.push(t("collab.permissionKinds.readOnly"));
  if (perms?.dataEntry) permList.push(t("collab.permissionKinds.dataEntry"));
  if (perms?.health) permList.push(t("collab.permissionKinds.health"));
  if (perms?.finance) permList.push(t("collab.permissionKinds.finance"));

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        {item.inviter.avatarUrl ? (
          <Image
            source={{ uri: item.inviter.avatarUrl }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons
              name="person"
              size={20}
              color={mobileColors.accent}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.farm} numberOfLines={1}>
            {item.farmName}
          </Text>
          <Text style={styles.inviter} numberOfLines={1}>
            {t("collab.pendingInvitations.invitedBy", {
              name: item.inviter.displayName
            })}
          </Text>
        </View>
      </View>

      <View style={styles.metaList}>
        <MetaLine label={t("collab.pendingInvitations.role")} value={roleLabel} />
        {permList.length > 0 ? (
          <MetaLine
            label={t("collab.fieldPermissions")}
            value={permList.join(" · ")}
          />
        ) : null}
      </View>

      {item.message ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageTxt}>“{item.message}”</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onReject}
          disabled={disabled}
          style={[styles.actionBtn, styles.actionBtnGhost]}
          accessibilityRole="button"
        >
          <Text style={styles.actionTxtGhost}>
            {t("collab.pendingInvitations.reject")}
          </Text>
        </Pressable>
        <Pressable
          onPress={onAccept}
          disabled={disabled}
          style={[styles.actionBtn, styles.actionBtnAccept]}
          accessibilityRole="button"
        >
          <Text style={styles.actionTxtAccept}>
            {t("collab.pendingInvitations.accept")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  closeBtn: { padding: 4 },
  title: {
    flex: 1,
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    textAlign: "center"
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.xl
  },
  emptyTxt: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  listContent: {
    padding: mobileSpacing.lg
  },
  sep: { height: mobileSpacing.md },
  row: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: mobileSpacing.md
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22
  },
  avatarFallback: {
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  farm: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "700"
  },
  inviter: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  metaList: { gap: 4 },
  metaRow: { flexDirection: "row" },
  metaLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600",
    width: 110
  },
  metaValue: {
    ...mobileTypography.meta,
    color: mobileColors.textPrimary,
    flex: 1
  },
  messageBox: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  messageTxt: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontStyle: "italic"
  },
  actions: {
    flexDirection: "row",
    gap: mobileSpacing.sm
  },
  actionBtn: {
    flex: 1,
    paddingVertical: mobileSpacing.sm + 2,
    borderRadius: mobileRadius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  actionBtnGhost: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  actionTxtGhost: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  actionBtnAccept: {
    backgroundColor: mobileColors.accent
  },
  actionTxtAccept: {
    ...mobileTypography.body,
    color: "#fff",
    fontWeight: "700"
  }
});
