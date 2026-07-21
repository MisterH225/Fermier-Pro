import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { mobileSpacing, mobileColors, mobileRadius, mobileFontSize } from "../../theme/mobileTheme";
import { ordersPalette, type OrderPalette } from "./orderTheme";

export type OrderTrackingStep = {
  key: string;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  timestamp?: string | null;
};

type Props = {
  steps: OrderTrackingStep[];
  activeIndex: number;
  disputedIndex?: number;
  palette?: OrderPalette;
  /** Adaptation iso-pixel des écrans historiques ; le défaut reste une coche. */
  completedIcon?: "checkmark" | "step";
  /** Dernière étape faite lorsque le flux n’a plus d’étape courante. */
  completedThroughIndex?: number;
};

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

export function OrderTrackingStepper({
  steps,
  activeIndex,
  disputedIndex,
  palette = ordersPalette,
  completedIcon = "checkmark",
  completedThroughIndex = activeIndex - 1
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const normalizedSteps = steps.slice(0, 5);

  return (
    <View style={styles.wrap} accessibilityRole="progressbar">
      {normalizedSteps.map((step, index) => {
        const done = index <= completedThroughIndex;
        const current = index === activeIndex;
        const active = done || current;
        const disputed = index === disputedIndex;
        const timeLabel = formatStepTime(step.timestamp, locale);

        return (
          <View key={step.key} style={styles.stepCol}>
            <View style={styles.railRow}>
              {index > 0 ? (
                <View
                  style={[
                    styles.line,
                    styles.lineLeft,
                    {
                      backgroundColor:
                        index <= completedThroughIndex || index <= activeIndex
                          ? palette.primary
                          : palette.railIdle
                    }
                  ]}
                />
              ) : (
                <View style={styles.lineSpacer} />
              )}

              <View style={styles.nodeSlot}>
                <View
                  style={[
                    styles.node,
                    {
                      borderRadius: palette.radius.pill,
                      backgroundColor: active
                        ? current
                          ? palette.primaryDark
                          : palette.primary
                        : palette.nodeIdle,
                      borderColor: active
                        ? current
                          ? palette.primaryDark
                          : palette.primary
                        : palette.railIdle
                    }
                  ]}
                >
                  <Ionicons
                    name={
                      done && completedIcon === "checkmark"
                        ? "checkmark"
                        : step.icon
                    }
                    size={16}
                    color={active ? palette.onPrimary : palette.textMuted}
                  />
                </View>
                {disputed ? (
                  <View
                    style={[
                      styles.alertBadge,
                      { backgroundColor: palette.danger }
                    ]}
                    accessibilityLabel={t("orders.disputed", {
                      defaultValue: "Litige"
                    })}
                  >
                    <Ionicons name="warning" size={9} color={mobileColors.background} />
                  </View>
                ) : null}
              </View>

              {index < normalizedSteps.length - 1 ? (
                <View
                  style={[
                    styles.line,
                    styles.lineRight,
                    {
                      backgroundColor:
                        index < completedThroughIndex ||
                        (index <= completedThroughIndex &&
                          index + 1 === activeIndex)
                          ? palette.primary
                          : palette.railIdle
                    }
                  ]}
                />
              ) : (
                <View style={styles.lineSpacer} />
              )}
            </View>
            <Text
              style={[
                styles.label,
                {
                  color: active
                    ? palette.textPrimary
                    : palette.textMuted,
                  fontWeight: active ? "800" : "600"
                }
              ]}
              numberOfLines={1}
            >
              {t(step.labelKey)}
            </Text>
            {timeLabel ? (
              <Text style={[styles.time, { color: palette.textSecondary }]}>
                {timeLabel}
              </Text>
            ) : null}
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
  line: { flex: 1, height: 3 },
  lineLeft: { borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  lineRight: { borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  nodeSlot: {
    width: 34,
    height: 34,
    position: "relative"
  },
  node: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2
  },
  alertBadge: {
    position: "absolute",
    top: -4,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: mobileRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: mobileColors.background
  },
  label: {
    fontSize: mobileFontSize.sm,
    textAlign: "center"
  },
  time: {
    fontSize: mobileFontSize.xs,
    fontWeight: "500"
  }
});
