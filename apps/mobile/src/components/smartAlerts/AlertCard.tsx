import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import type { SmartAlertListItemDto } from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileStatusSurfaces } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import { useTranslation } from "react-i18next";
import { resolveSmartAlertText } from "../../lib/smartAlertDisplay";
import { resolveDeepNavProfile } from "../../lib/resolveDeepNavProfile";
import { navigateToAlert } from "../../services/navigation/DeepNavigationService";
import { useSession } from "../../context/SessionContext";
import { merchantColors } from "../../theme/merchantTheme";
import { producerColors } from "../../theme/producerTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

function moduleIcon(
  m: SmartAlertListItemDto["module"]
): keyof typeof Ionicons.glyphMap {
  switch (m) {
    case "stock":
      return "cube-outline";
    case "health":
      return "medkit-outline";
    case "finance":
      return "wallet-outline";
    case "gestation":
      return "heart-outline";
    case "cheptel":
      return "paw-outline";
    case "market":
      return "trending-up-outline";
    default:
      return "notifications-outline";
  }
}

function moduleIconColors(m: SmartAlertListItemDto["module"]): {
  bg: string;
  fg: string;
} {
  switch (m) {
    case "finance":
      return { bg: uiNamedColors.cD1FAE5, fg: merchantColors.greenText };
    case "stock":
      return { bg: producerColors.kpiAmberSoft, fg: producerColors.warningDeep };
    case "health":
      return { bg: mobileStatusSurfaces.errorBg, fg: producerColors.dangerStrong };
    case "market":
      return { bg: merchantColors.blueSoftBg, fg: uiNamedColors.c1D4ED8 };
    case "gestation":
      return { bg: uiNamedColors.cFCE7F3, fg: uiNamedColors.cBE185D };
    case "cheptel":
      return { bg: producerColors.financeIndigoBg, fg: uiNamedColors.c4338CA };
    default:
      return { bg: uiNamedColors.cD1FAE5, fg: merchantColors.greenText };
  }
}

type AlertCardProps = {
  alert: SmartAlertListItemDto;
  navigation: NativeStackNavigationProp<RootStackParamList>;
  onMarkRead: (id: string) => void;
  onDelete?: (id: string) => void;
};

/** Même format inbox que `UserNotificationCard` (icône, titre, corps, date, point vert). */
export function AlertCard({
  alert,
  navigation,
  onMarkRead,
  onDelete
}: AlertCardProps) {
  const { t } = useTranslation();
  const { authMe, activeProfileId } = useSession();
  const display = resolveSmartAlertText(alert, t);
  const profile = resolveDeepNavProfile(authMe, activeProfileId);
  const colors = moduleIconColors(alert.module);

  const onPressCard = useCallback(() => {
    if (!alert.isRead) {
      onMarkRead(alert.id);
    }
    navigateToAlert(
      navigation,
      {
        id: alert.id,
        module: alert.module,
        ruleKey: alert.ruleKey,
        action: alert.action
      },
      profile
    );
  }, [alert, navigation, onMarkRead, profile]);

  const renderRight = useCallback(() => {
    const actions = [];
    if (!alert.isRead) {
      actions.push(
        <Pressable
          key="read"
          style={styles.swipeRead}
          onPress={() => onMarkRead(alert.id)}
          accessibilityRole="button"
          accessibilityLabel={t("smartAlerts.markRead")}
        >
          <Ionicons name="checkmark-done" size={22} color={mobileColors.background} />
        </Pressable>
      );
    }
    if (onDelete) {
      actions.push(
        <Pressable
          key="delete"
          style={styles.swipeDelete}
          onPress={() => onDelete(alert.id)}
          accessibilityRole="button"
          accessibilityLabel={t("smartAlerts.delete")}
        >
          <Ionicons name="trash-outline" size={22} color={mobileColors.background} />
        </Pressable>
      );
    }
    if (actions.length === 0) {
      return null;
    }
    return <View style={styles.swipeActions}>{actions}</View>;
  }, [alert.id, alert.isRead, onDelete, onMarkRead, t]);

  const stamp = alert.createdAt
    ? new Date(alert.createdAt).toLocaleString()
    : "";

  const body = (
    <Pressable
      onPress={onPressCard}
      style={({ pressed }) => [
        styles.card,
        !alert.isRead && styles.cardUnread,
        alert.isRead && styles.cardRead,
        pressed && { opacity: 0.9 }
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.bg }]}>
        <Ionicons name={moduleIcon(alert.module)} size={20} color={colors.fg} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <Text style={styles.subject} numberOfLines={2}>
            {display.title}
          </Text>
          {!alert.isRead ? <View style={styles.dot} /> : null}
        </View>
        <Text style={styles.message} numberOfLines={4}>
          {display.message}
        </Text>
        {stamp ? <Text style={styles.meta}>{stamp}</Text> : null}
      </View>
    </Pressable>
  );

  if (alert.isRead && !onDelete) {
    return body;
  }

  return (
    <Swipeable renderRightActions={renderRight} overshootRight={false}>
      {body}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: mobileSpacing.md,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.background,
    borderWidth: 1,
    borderColor: mobileColors.border,
    marginBottom: mobileSpacing.sm
  },
  cardUnread: { borderColor: mobileColors.accent },
  cardRead: { opacity: 0.85 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  cardBody: { flex: 1, gap: 4 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  subject: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    flex: 1
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: mobileRadius.sm,
    backgroundColor: mobileColors.accent,
    marginTop: 6
  },
  message: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  swipeRead: {
    backgroundColor: mobileColors.success,
    justifyContent: "center",
    alignItems: "center",
    width: 72,
    marginBottom: mobileSpacing.sm,
    borderRadius: mobileRadius.md
  },
  swipeDelete: {
    backgroundColor: mobileColors.error,
    justifyContent: "center",
    alignItems: "center",
    width: 72,
    marginBottom: mobileSpacing.sm,
    borderRadius: mobileRadius.md
  },
  swipeActions: {
    flexDirection: "row",
    gap: 4
  }
});
