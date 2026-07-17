import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import {
  buildOrderActivityEvents,
  type OrderActivityEvent
} from "../../../lib/merchantOrderTracking";
import type { MerchantOrderDto } from "../../../lib/api";
import { merchantColors, merchantRadius, merchantShadow } from "../../../theme/merchantTheme";
import { mobileSpacing, mobileTypography } from "../../../theme/mobileTheme";

type Props = {
  order: MerchantOrderDto;
};

function formatActivityWhen(iso: string, locale: string) {
  try {
    const d = new Date(iso);
    const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    const date = d.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    return `${time}, ${date}`;
  } catch {
    return iso;
  }
}

function activityMessage(
  t: (k: string, o?: Record<string, unknown>) => string,
  event: OrderActivityEvent
) {
  if (event.note?.trim()) return event.note.trim();
  const key = `merchant.orders.activity.${event.statusTo}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return t("merchant.orders.activity.generic", {
    status: t(`merchant.orders.status.${event.statusTo}`, {
      defaultValue: event.statusTo
    })
  });
}

export function MerchantOrderActivitySheet({ order }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const events = buildOrderActivityEvents(order);

  return (
    <View style={[styles.sheet, merchantShadow.floating]}>
      <View style={styles.handle} />
      <Text style={styles.title}>{t("merchant.orders.activity.title")}</Text>
      {events.length === 0 ? (
        <Text style={styles.empty}>{t("merchant.orders.activity.empty")}</Text>
      ) : (
        <View style={styles.list}>
          {events.map((event, idx) => {
            const last = idx === events.length - 1;
            return (
              <View key={event.id} style={styles.row}>
                <Text style={styles.when} numberOfLines={2}>
                  {formatActivityWhen(event.at, locale)}
                </Text>
                <View style={styles.rail}>
                  <View style={styles.dot}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                  {!last ? <View style={styles.line} /> : null}
                </View>
                <Text style={styles.message}>{activityMessage(t, event)}</Text>
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
    backgroundColor: merchantColors.cardBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: merchantRadius.card,
    borderBottomRightRadius: merchantRadius.card,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    paddingBottom: mobileSpacing.lg,
    borderWidth: 1,
    borderColor: merchantColors.border,
    marginTop: mobileSpacing.sm
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0D6CE",
    marginBottom: mobileSpacing.md
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: merchantColors.textPrimary,
    marginBottom: mobileSpacing.md
  },
  empty: {
    ...mobileTypography.body,
    color: merchantColors.textSecondary,
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
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    color: merchantColors.textSecondary,
    paddingTop: 2
  },
  rail: { width: 22, alignItems: "center" },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: merchantColors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: merchantColors.primarySoft,
    marginVertical: 2
  },
  message: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: merchantColors.textPrimary,
    paddingTop: 2,
    paddingBottom: mobileSpacing.md
  }
});
