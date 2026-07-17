import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatMarketMoney } from "../../lib/formatMoney";
import { mobileSpacing } from "../../theme/mobileTheme";
import { OrderDeadlineBanner } from "./OrderDeadlineBanner";
import {
  OrderStatusBadge,
  type OrderStatusTone
} from "./OrderStatusBadge";
import { ordersPalette, type OrderPalette } from "./orderTheme";

type Props = {
  reference: string;
  counterparty: string;
  amount: number;
  currency: string;
  statusLabelKey: string;
  statusTone: OrderStatusTone;
  /** Petite étiquette escrow / boutique sur la carte hub. */
  typeLabelKey?: string;
  itemSummary?: string;
  actionRequiredByMe?: boolean;
  nextActionKey?: string | null;
  deadlineAt?: string | null;
  deadlineLabelKey?: string;
  onPress?: () => void;
  palette?: OrderPalette;
};

export function OrderCard({
  reference,
  counterparty,
  amount,
  currency,
  statusLabelKey,
  statusTone,
  typeLabelKey,
  itemSummary,
  actionRequiredByMe,
  nextActionKey,
  deadlineAt,
  deadlineLabelKey = "orders.respondBefore",
  onPress,
  palette = ordersPalette
}: Props) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.cardBg,
          borderColor: palette.border,
          borderRadius: palette.radius.card
        },
        palette.shadow.card,
        pressed && styles.pressed
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.referenceBlock}>
          <View style={styles.referenceMeta}>
            <Text style={[styles.referenceLabel, { color: palette.textSecondary }]}>
              {t("orders.trackingNumber", { defaultValue: "N° de suivi" })}
            </Text>
            {typeLabelKey ? (
              <View
                style={[
                  styles.typeTag,
                  { backgroundColor: palette.primaryLight }
                ]}
              >
                <Text style={[styles.typeTagText, { color: palette.primaryDark }]}>
                  {t(typeLabelKey)}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[styles.reference, { color: palette.textPrimary }]}
            numberOfLines={1}
          >
            {reference}
          </Text>
          {itemSummary ? (
            <Text
              style={[styles.itemSummary, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              {itemSummary}
            </Text>
          ) : null}
        </View>
        <OrderStatusBadge
          labelKey={statusLabelKey}
          tone={statusTone}
          palette={palette}
        />
      </View>

      <View style={styles.infoRow}>
        <View style={styles.counterparty}>
          <View
            style={[styles.avatar, { backgroundColor: palette.primaryLight }]}
          >
            <Text style={[styles.avatarText, { color: palette.primary }]}>
              {(counterparty.trim().charAt(0) || "?").toUpperCase()}
            </Text>
          </View>
          <Text
            style={[styles.counterpartyText, { color: palette.textPrimary }]}
            numberOfLines={1}
          >
            {counterparty}
          </Text>
        </View>
        <Text style={[styles.amount, { color: palette.textPrimary }]}>
          {formatMarketMoney(amount, currency)}
        </Text>
      </View>

      {actionRequiredByMe && nextActionKey ? (
        <View
          style={[
            styles.nextAction,
            { backgroundColor: palette.primaryLight }
          ]}
        >
          <Ionicons
            name="arrow-forward-circle"
            size={17}
            color={palette.primary}
          />
          <Text style={[styles.nextActionText, { color: palette.primaryDark }]}>
            {t("orders.nextAction", {
              action: t(nextActionKey),
              defaultValue: `Prochaine action : ${t(nextActionKey)}`
            })}
          </Text>
        </View>
      ) : null}

      {deadlineAt ? (
        <OrderDeadlineBanner
          deadlineAt={deadlineAt}
          labelKey={deadlineLabelKey}
          palette={palette}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: mobileSpacing.md,
    borderWidth: 1,
    gap: mobileSpacing.md
  },
  pressed: { opacity: 0.94 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  referenceBlock: { flex: 1, gap: 2 },
  referenceMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap"
  },
  referenceLabel: { fontSize: 11, fontWeight: "600" },
  typeTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999
  },
  typeTagText: { fontSize: 10, fontWeight: "800" },
  reference: { fontSize: 16, fontWeight: "800" },
  itemSummary: { fontSize: 12, fontWeight: "500" },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  counterparty: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { fontSize: 14, fontWeight: "800" },
  counterpartyText: { flex: 1, fontSize: 14, fontWeight: "700" },
  amount: { fontSize: 15, fontWeight: "800" },
  nextAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10
  },
  nextActionText: { flex: 1, fontSize: 12, fontWeight: "700" }
});
