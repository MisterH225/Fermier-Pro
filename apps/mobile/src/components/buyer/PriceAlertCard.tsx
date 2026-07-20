import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import type { BuyerPriceAlertDto } from "../../lib/api";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { buyerColors, buyerRadius, buyerShadow } from "../../theme/buyerTheme";

type Props = {
  alert: BuyerPriceAlertDto;
  onToggleActive: (next: boolean) => void;
  onDelete: () => void;
  toggling?: boolean;
};

const CATEGORY_KEYS: Record<string, string> = {
  piglet: "buyerOnboarding.cat.piglet",
  breeder: "buyerOnboarding.cat.breeder_female",
  breeder_male: "buyerOnboarding.cat.breeder_male",
  breeder_female: "buyerOnboarding.cat.breeder_female",
  butcher: "buyerOnboarding.cat.butcher",
  reformed: "buyerOnboarding.cat.reformed"
};

export function PriceAlertCard({
  alert,
  onToggleActive,
  onDelete,
  toggling = false
}: Props) {
  const { t } = useTranslation();
  const categoryLabel = t(
    (CATEGORY_KEYS[alert.animalCategory] ?? "buyer.alerts.categoryOther") as never
  );

  const confirmDelete = () => {
    Alert.alert(t("buyer.alerts.deleteTitle"), t("buyer.alerts.deleteBody"), [
      { text: t("buyer.alerts.cancel"), style: "cancel" },
      { text: t("buyer.alerts.deleteConfirm"), style: "destructive", onPress: onDelete }
    ]);
  };

  return (
    <View style={[styles.card, buyerShadow.card, !alert.isActive && styles.cardInactive]}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.category}>{categoryLabel}</Text>
          <Text style={styles.price}>
            {t("buyer.alerts.maxPrice", { price: alert.maxPricePerKg })}
          </Text>
        </View>
        <Switch
          value={alert.isActive}
          onValueChange={onToggleActive}
          disabled={toggling}
          trackColor={{ false: buyerColors.border, true: `${buyerColors.primary}88` }}
          thumbColor={
            alert.isActive ? buyerColors.primary : buyerColors.switchThumbOff
          }
        />
      </View>

      <View style={styles.metaRow}>
        {alert.minWeightKg ? (
          <Text style={styles.meta}>
            {t("buyer.alerts.minWeight", { kg: alert.minWeightKg })}
          </Text>
        ) : null}
        {alert.radiusKm ? (
          <Text style={styles.meta}>
            {t("buyer.alerts.radius", { km: alert.radiusKm })}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          {t(`buyer.alerts.freq.${alert.notificationFrequency}`)}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.matchBadge}>
          <Ionicons name="pricetag-outline" size={14} color={buyerColors.primary} />
          <Text style={styles.matchText}>
            {t("buyer.alerts.matchingCount", { count: alert.matchingListingsCount })}
          </Text>
        </View>
        <Pressable onPress={confirmDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={20} color={buyerColors.danger} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: buyerColors.cardBg,
    borderRadius: buyerRadius.card,
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  cardInactive: { opacity: 0.72 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  titleBlock: { flex: 1, gap: 2 },
  category: {
    ...mobileTypography.cardTitle,
    color: buyerColors.textPrimary
  },
  price: {
    ...mobileTypography.body,
    color: buyerColors.primary,
    fontWeight: "600"
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  meta: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: mobileSpacing.xs
  },
  matchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${buyerColors.primary}12`,
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 4,
    borderRadius: buyerRadius.pill
  },
  matchText: {
    ...mobileTypography.meta,
    color: buyerColors.primary,
    fontWeight: "600"
  }
});
