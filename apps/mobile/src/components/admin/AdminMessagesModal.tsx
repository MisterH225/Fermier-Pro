import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../context/SessionContext";
import {
  fetchMyAdminMessages,
  markMyAdminMessageRead,
  type AdminMessageDto,
  type AdminMessageTypeDto
} from "../../lib/api";
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

const TYPE_META: Record<
  AdminMessageTypeDto,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }
> = {
  warning: { icon: "warning", color: "#B45309", bg: "#FEF3C7", label: "⚠️" },
  info: { icon: "information-circle", color: "#1D4ED8", bg: "#DBEAFE", label: "ℹ️" },
  notification: { icon: "megaphone", color: "#047857", bg: "#D1FAE5", label: "📢" }
};

function MessageCard({
  msg,
  onMarkRead
}: {
  msg: AdminMessageDto;
  onMarkRead: (id: string) => void;
}) {
  const meta = TYPE_META[msg.type] ?? TYPE_META.notification;
  return (
    <Pressable
      onPress={() => !msg.isRead && onMarkRead(msg.id)}
      style={({ pressed }) => [
        styles.card,
        !msg.isRead && styles.cardUnread,
        pressed && { opacity: 0.9 }
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <Text style={styles.subject} numberOfLines={2}>
            {msg.subject}
          </Text>
          {!msg.isRead ? <View style={styles.dot} /> : null}
        </View>
        <Text style={styles.message}>{msg.message}</Text>
        <Text style={styles.meta}>
          {new Date(msg.sentAt).toLocaleString()}
          {msg.admin.fullName ? ` · ${msg.admin.fullName}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

export function AdminMessagesModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { accessToken } = useSession();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["auth.me.adminMessages"],
    queryFn: () => fetchMyAdminMessages(accessToken!),
    enabled: Boolean(visible && accessToken)
  });

  const onMarkRead = async (id: string) => {
    if (!accessToken) return;
    try {
      await markMyAdminMessageRead(accessToken, id);
      await qc.invalidateQueries({ queryKey: ["auth.me.adminMessages"] });
      await qc.invalidateQueries({ queryKey: ["auth.me.adminMessages.unreadCount"] });
    } catch {
      // best effort
    }
  };

  const items = q.data?.items ?? [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <Text style={styles.title}>
            {t("adminMessages.title", "Messages de l'administration")}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel={t("producer.close")}
            style={styles.closeBtn}
          >
            <Text style={styles.closeTx}>{t("producer.close")}</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {q.isLoading ? (
            <ActivityIndicator size="small" color={mobileColors.accent} />
          ) : items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons
                name="mail-open-outline"
                size={36}
                color={mobileColors.textSecondary}
              />
              <Text style={styles.emptyTx}>
                {t("adminMessages.empty", "Aucun message pour l'instant.")}
              </Text>
            </View>
          ) : (
            items.map((m) => <MessageCard key={m.id} msg={m} onMarkRead={onMarkRead} />)
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.canvas },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm
  },
  title: {
    ...mobileTypography.title,
    fontSize: 20,
    color: mobileColors.textPrimary,
    flex: 1
  },
  closeBtn: { minHeight: 36, justifyContent: "center", paddingHorizontal: 4 },
  closeTx: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  scroll: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl,
    gap: mobileSpacing.md
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: mobileSpacing.xxl,
    gap: mobileSpacing.sm
  },
  emptyTx: { color: mobileColors.textSecondary },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.md,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.lg,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  cardUnread: {
    borderColor: mobileColors.accent,
    backgroundColor: "#FFFFFF"
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  cardBody: { flex: 1, gap: 4 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: mobileColors.accent
  },
  subject: {
    ...mobileTypography.body,
    fontWeight: "700",
    flex: 1
  },
  message: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  }
});
