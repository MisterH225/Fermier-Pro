import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { mobileSpacing, mobileTypography, mobileColors, mobileRadius, mobileFontSize } from "../../theme/mobileTheme";
import type { OrderStatusTone } from "./OrderStatusBadge";
import { ordersPalette, type OrderPalette } from "./orderTheme";

export type OrderActivityEvent = {
  at: string;
  labelKey?: string;
  label?: string;
  tone: OrderStatusTone;
};

type Props = {
  events: OrderActivityEvent[];
  palette?: OrderPalette;
  titleKey?: string;
  emptyLabelKey?: string;
};

function formatWhen(iso: string, locale: string) {
  try {
    const date = new Date(iso);
    const time = date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit"
    });
    const day = date.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    return `${time}, ${day}`;
  } catch {
    return iso;
  }
}

function dotColor(tone: OrderStatusTone, palette: OrderPalette) {
  switch (tone) {
    case "pending":
      return palette.warning;
    case "success":
      return palette.badges.success.foreground;
    case "danger":
      return palette.danger;
    case "neutral":
      return palette.textMuted;
    case "active":
    default:
      return palette.primary;
  }
}

export function OrderActivityFeed({
  events,
  palette = ordersPalette,
  titleKey = "orders.activity.title",
  emptyLabelKey = "orders.activity.empty"
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: palette.cardBg,
          borderColor: palette.border,
          borderBottomLeftRadius: palette.radius.card,
          borderBottomRightRadius: palette.radius.card
        },
        palette.shadow.floating
      ]}
    >
      <View
        style={[styles.handle, { backgroundColor: palette.activityHandle }]}
      />
      <Text style={[styles.title, { color: palette.textPrimary }]}>
        {t(titleKey)}
      </Text>
      {events.length === 0 ? (
        <Text style={[styles.empty, { color: palette.textSecondary }]}>
          {t(emptyLabelKey)}
        </Text>
      ) : (
        <View style={styles.list}>
          {events.map((event, index) => {
            const last = index === events.length - 1;
            const color = dotColor(event.tone, palette);
            return (
              <View key={`${event.at}-${index}`} style={styles.row}>
                <Text
                  style={[styles.when, { color: palette.textSecondary }]}
                  numberOfLines={2}
                >
                  {formatWhen(event.at, locale)}
                </Text>
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: color }]}>
                    <Ionicons name="checkmark" size={12} color={mobileColors.background} />
                  </View>
                  {!last ? (
                    <View
                      style={[
                        styles.line,
                        { backgroundColor: palette.primarySoft }
                      ]}
                    />
                  ) : null}
                </View>
                <Text
                  style={[styles.message, { color: palette.textPrimary }]}
                >
                  {event.label ?? (event.labelKey ? t(event.labelKey) : "")}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    paddingBottom: mobileSpacing.lg,
    borderWidth: 1,
    marginTop: mobileSpacing.sm
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: mobileRadius.sm,
    marginBottom: mobileSpacing.md
  },
  title: {
    fontSize: mobileFontSize.lg,
    fontWeight: "800",
    marginBottom: mobileSpacing.md
  },
  empty: {
    ...mobileTypography.body,
    textAlign: "center",
    paddingVertical: mobileSpacing.md
  },
  list: { gap: 0 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    minHeight: 56
  },
  when: {
    width: 88,
    fontSize: mobileFontSize.xs,
    lineHeight: 15,
    fontWeight: "600",
    paddingTop: 2
  },
  rail: { width: 22, alignItems: "center" },
  dot: {
    width: 22,
    height: 22,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 28,
    marginVertical: 2
  },
  message: {
    flex: 1,
    fontSize: mobileFontSize.sm,
    lineHeight: 18,
    fontWeight: "500",
    paddingTop: 2,
    paddingBottom: mobileSpacing.md
  }
});
