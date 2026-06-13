import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import type { SmartAlertListItemDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import { useTranslation } from "react-i18next";
import { resolveSmartAlertText } from "../../lib/smartAlertDisplay";
import { resolveDeepNavProfile } from "../../lib/resolveDeepNavProfile";
import { navigateToAlert } from "../../services/navigation/DeepNavigationService";
import { useSession } from "../../context/SessionContext";

function priorityIcon(p: SmartAlertListItemDto["priority"]): string {
  if (p === "critical") return "alert-circle";
  if (p === "warning") return "warning";
  return "information-circle-outline";
}

function priorityColor(p: SmartAlertListItemDto["priority"]): string {
  if (p === "critical") return mobileColors.error;
  if (p === "warning") return mobileColors.warning;
  return mobileColors.accent;
}

function moduleLabel(
  m: SmartAlertListItemDto["module"],
  t: (key: string) => string
): string {
  const map: Record<SmartAlertListItemDto["module"], string> = {
    stock: "Stock",
    health: "Santé",
    finance: "Finance",
    gestation: "Gestation",
    cheptel: "Cheptel",
    market: t("smartAlerts.moduleMarket")
  };
  return map[m];
}

type AlertCardProps = {
  alert: SmartAlertListItemDto;
  navigation: NativeStackNavigationProp<RootStackParamList>;
  onMarkRead: (id: string) => void;
  onDelete?: (id: string) => void;
};

export function AlertCard({ alert, navigation, onMarkRead, onDelete }: AlertCardProps) {
  const { t } = useTranslation();
  const { authMe, activeProfileId } = useSession();
  const display = resolveSmartAlertText(alert, t);
  const profile = resolveDeepNavProfile(authMe, activeProfileId);
  const onPressCard = useCallback(() => {
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
  }, [alert, navigation, profile]);

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
          <Ionicons name="checkmark-done" size={22} color={mobileColors.onAccent} />
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
          <Ionicons name="trash-outline" size={22} color={mobileColors.onAccent} />
        </Pressable>
      );
    }
    if (actions.length === 0) {
      return null;
    }
    return <View style={styles.swipeActions}>{actions}</View>;
  }, [alert.id, alert.isRead, onDelete, onMarkRead, t]);

  const body = (
    <Pressable
      onPress={onPressCard}
      style={({ pressed }) => [
        styles.card,
        alert.isRead && styles.cardRead,
        pressed && styles.cardPressed
      ]}
    >
      <View style={styles.rowTop}>
        <Ionicons
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name={priorityIcon(alert.priority) as any}
          size={22}
          color={priorityColor(alert.priority)}
        />
        <View style={styles.titleCol}>
          <Text style={styles.title} numberOfLines={2}>
            {display.title}
          </Text>
          <View style={styles.tag}>
            <Text style={styles.tagTx}>{moduleLabel(alert.module, t)}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.message}>{display.message}</Text>
      {alert.action?.route ? (
        <Text style={styles.actionHint}>
          → {alert.action.label}
        </Text>
      ) : null}
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
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  cardRead: {
    opacity: 0.55
  },
  cardPressed: {
    opacity: 0.88
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.xs
  },
  titleCol: {
    flex: 1,
    minWidth: 0
  },
  title: {
    ...mobileTypography.cardTitle,
    fontSize: 15,
    color: mobileColors.textPrimary
  },
  tag: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: mobileRadius.pill,
    backgroundColor: `${mobileColors.accent}22`
  },
  tagTx: {
    ...mobileTypography.meta,
    fontSize: 11,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  message: {
    ...mobileTypography.body,
    fontSize: 14,
    color: mobileColors.textSecondary,
    lineHeight: 20
  },
  actionHint: {
    ...mobileTypography.meta,
    marginTop: mobileSpacing.sm,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  swipeRead: {
    backgroundColor: mobileColors.success,
    justifyContent: "center",
    alignItems: "center",
    width: 72,
    height: "100%"
  },
  swipeDelete: {
    backgroundColor: mobileColors.error,
    justifyContent: "center",
    alignItems: "center",
    width: 72,
    height: "100%"
  },
  swipeActions: {
    flexDirection: "row",
    marginBottom: mobileSpacing.sm,
    borderTopRightRadius: mobileRadius.md,
    borderBottomRightRadius: mobileRadius.md,
    overflow: "hidden"
  }
});
