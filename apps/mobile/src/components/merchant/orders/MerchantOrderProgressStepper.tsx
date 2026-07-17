import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { MerchantOrderDto } from "../../../lib/api";
import {
  isProgressStepCurrent,
  isProgressStepDone,
  ORDER_PROGRESS_STEPS,
  type OrderProgressStepKey
} from "../../../lib/merchantOrderTracking";
import { merchantColors, merchantRadius } from "../../../theme/merchantTheme";
import { mobileSpacing } from "../../../theme/mobileTheme";

const STEP_ICON: Record<OrderProgressStepKey, keyof typeof Ionicons.glyphMap> = {
  received: "cube",
  in_transit: "bicycle",
  delivered: "checkmark"
};

function stampForStep(order: MerchantOrderDto, key: OrderProgressStepKey) {
  if (key === "received") return order.paidAt ?? order.confirmedAt;
  if (key === "in_transit") return order.shippedAt;
  return order.deliveredAt ?? order.completedAt;
}

function formatStepTime(iso: string | null | undefined, locale: string) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return null;
  }
}

type Props = {
  order: MerchantOrderDto;
};

export function MerchantOrderProgressStepper({ order }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";

  return (
    <View style={styles.wrap} accessibilityRole="progressbar">
      {ORDER_PROGRESS_STEPS.map((step, idx) => {
        const done = isProgressStepDone(order.status, step);
        const current = isProgressStepCurrent(order.status, step.key);
        const active = done || current;
        const timeLabel = formatStepTime(stampForStep(order, step.key), locale);
        const next = ORDER_PROGRESS_STEPS[idx + 1];
        const segmentFilled =
          Boolean(next) &&
          done &&
          (isProgressStepDone(order.status, next) ||
            isProgressStepCurrent(order.status, next.key));

        return (
          <View key={step.key} style={styles.stepCol}>
            <View style={styles.railRow}>
              {idx > 0 ? (
                <View
                  style={[
                    styles.line,
                    styles.lineLeft,
                    (isProgressStepDone(order.status, ORDER_PROGRESS_STEPS[idx - 1]) &&
                      (done || current)) &&
                      styles.lineOn
                  ]}
                />
              ) : (
                <View style={styles.lineSpacer} />
              )}
              <View
                style={[
                  styles.node,
                  active && styles.nodeOn,
                  current && styles.nodeCurrent
                ]}
              >
                <Ionicons
                  name={STEP_ICON[step.key]}
                  size={16}
                  color={active ? "#fff" : merchantColors.textMuted}
                />
              </View>
              {idx < ORDER_PROGRESS_STEPS.length - 1 ? (
                <View
                  style={[styles.line, styles.lineRight, segmentFilled && styles.lineOn]}
                />
              ) : (
                <View style={styles.lineSpacer} />
              )}
            </View>
            <Text style={[styles.label, active && styles.labelOn]} numberOfLines={1}>
              {t(`merchant.orders.progress.${step.key}`)}
            </Text>
            {timeLabel ? <Text style={styles.time}>{timeLabel}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: mobileSpacing.sm
  },
  stepCol: { flex: 1, alignItems: "center", gap: 6 },
  railRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 36
  },
  lineSpacer: { flex: 1 },
  line: { flex: 1, height: 3, backgroundColor: "#E8E0DA" },
  lineLeft: { borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  lineRight: { borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  lineOn: { backgroundColor: merchantColors.primary },
  node: {
    width: 34,
    height: 34,
    borderRadius: merchantRadius.pill,
    backgroundColor: "#F0EAE4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E8E0DA"
  },
  nodeOn: {
    backgroundColor: merchantColors.primary,
    borderColor: merchantColors.primary
  },
  nodeCurrent: {
    backgroundColor: merchantColors.primaryDark,
    borderColor: merchantColors.primaryDark
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: merchantColors.textMuted,
    textAlign: "center"
  },
  labelOn: { color: merchantColors.textPrimary, fontWeight: "800" },
  time: {
    fontSize: 11,
    color: merchantColors.textSecondary,
    fontWeight: "500"
  }
});
