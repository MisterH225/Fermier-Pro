import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import type { AdminMessageDto, AdminMessageTypeDto } from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { producerColors } from "../../theme/producerTheme";
import { merchantColors } from "../../theme/merchantTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

const TYPE_META: Record<
  AdminMessageTypeDto,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  warning: { icon: "warning", color: producerColors.warningDeep, bg: producerColors.kpiAmberSoft },
  info: { icon: "information-circle", color: uiNamedColors.c1D4ED8, bg: merchantColors.blueSoftBg },
  notification: { icon: "megaphone", color: merchantColors.greenText, bg: uiNamedColors.cD1FAE5 }
};

type Props = {
  msg: AdminMessageDto;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  adminTag?: string;
};

export function AdminMessageCard({ msg, onMarkRead, onDelete, adminTag }: Props) {
  const { t } = useTranslation();
  const meta = TYPE_META[msg.type] ?? TYPE_META.notification;

  const body = (
    <Pressable
      onPress={() => !msg.isRead && onMarkRead?.(msg.id)}
      style={({ pressed }) => [
        styles.card,
        !msg.isRead && styles.cardUnread,
        msg.isRead && styles.cardRead,
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
        {adminTag ? (
          <View style={styles.tag}>
            <Text style={styles.tagTx}>{adminTag}</Text>
          </View>
        ) : null}
        <Text style={styles.message} numberOfLines={4}>
          {msg.message}
        </Text>
        <Text style={styles.meta}>
          {new Date(msg.sentAt).toLocaleString()}
          {msg.admin.fullName ? ` · ${msg.admin.fullName}` : ""}
        </Text>
      </View>
    </Pressable>
  );

  if (!onDelete) {
    return body;
  }

  return (
    <Swipeable
      renderRightActions={() => (
        <Pressable
          style={styles.swipeDelete}
          onPress={() => onDelete(msg.id)}
          accessibilityRole="button"
          accessibilityLabel={t("smartAlerts.delete")}
        >
          <Ionicons name="trash-outline" size={22} color={mobileColors.onAccent} />
          <Text style={styles.swipeDeleteTx}>{t("smartAlerts.delete")}</Text>
        </Pressable>
      )}
      overshootRight={false}
    >
      {body}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.md,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.background,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  cardUnread: {
    borderColor: mobileColors.accent
  },
  cardRead: {
    opacity: 0.85
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  cardBody: { flex: 1, gap: 4 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: mobileRadius.sm,
    backgroundColor: mobileColors.accent,
    marginTop: 6
  },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: mobileRadius.pill,
    backgroundColor: `${mobileColors.accent}22`
  },
  tagTx: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  subject: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.md,
    color: mobileColors.textPrimary,
    flex: 1
  },
  message: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary,
    lineHeight: 20
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  swipeDelete: {
    backgroundColor: mobileColors.error,
    justifyContent: "center",
    alignItems: "center",
    width: 88,
    marginBottom: mobileSpacing.sm,
    borderTopRightRadius: mobileRadius.md,
    borderBottomRightRadius: mobileRadius.md,
    gap: 4
  },
  swipeDeleteTx: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    fontWeight: "700",
    color: mobileColors.onAccent
  }
});
