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

function moduleLabel(m: SmartAlertListItemDto["module"]): string {
  const map: Record<SmartAlertListItemDto["module"], string> = {
    stock: "Stock",
    health: "Santé",
    finance: "Finance",
    gestation: "Gestation",
    cheptel: "Cheptel"
  };
  return map[m];
}

type AlertCardProps = {
  alert: SmartAlertListItemDto;
  navigation: NativeStackNavigationProp<RootStackParamList>;
  onMarkRead: (id: string) => void;
};

export function AlertCard({ alert, navigation, onMarkRead }: AlertCardProps) {
  const onPressCard = useCallback(() => {
    const a = alert.action;
    if (a?.route) {
      // Routes dynamiques alignées sur RootStackParamList (émises par l’API).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigation.navigate(a.route as any, (a.params ?? {}) as any);
    }
  }, [alert.action, navigation]);

  const renderRight = useCallback(() => {
    if (alert.isRead) {
      return null;
    }
    return (
      <Pressable
        style={styles.swipeRead}
        onPress={() => onMarkRead(alert.id)}
        accessibilityRole="button"
        accessibilityLabel="Marquer comme lu"
      >
        <Ionicons name="checkmark-done" size={22} color="#fff" />
      </Pressable>
    );
  }, [alert.id, alert.isRead, onMarkRead]);

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
            {alert.title}
          </Text>
          <View style={styles.tag}>
            <Text style={styles.tagTx}>{moduleLabel(alert.module)}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.message}>{alert.message}</Text>
      {alert.action?.route ? (
        <Text style={styles.actionHint}>
          → {alert.action.label}
        </Text>
      ) : null}
    </Pressable>
  );

  if (alert.isRead) {
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
    marginBottom: mobileSpacing.sm,
    borderTopRightRadius: mobileRadius.md,
    borderBottomRightRadius: mobileRadius.md
  }
});
