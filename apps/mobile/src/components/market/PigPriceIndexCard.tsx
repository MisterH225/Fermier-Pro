import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../../context/SessionContext";
import { fetchHybridPigPriceIndex, type HybridPigPriceIndexDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

function formatRelativeTime(iso: string | null, locale: string): string {
  if (!iso) {
    return "—";
  }
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "—";
  }
  const diffMin = Math.max(0, Math.floor((Date.now() - then) / 60_000));
  if (diffMin < 60) {
    return locale.startsWith("en")
      ? `Updated ${diffMin} min ago`
      : `Mis à jour il y a ${diffMin} min`;
  }
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 48) {
    return locale.startsWith("en")
      ? `Updated ${diffH} h ago`
      : `Mis à jour il y a ${diffH} h`;
  }
  const diffD = Math.floor(diffH / 24);
  return locale.startsWith("en")
    ? `Updated ${diffD} d ago`
    : `Mis à jour il y a ${diffD} j`;
}

function trendIcon(trend: "up" | "down" | "stable") {
  if (trend === "up") {
    return "arrow-up" as const;
  }
  if (trend === "down") {
    return "arrow-down" as const;
  }
  return "remove" as const;
}

function trendColor(trend: "up" | "down" | "stable", variation: number | null) {
  if (trend === "stable" || variation == null) {
    return mobileColors.textSecondary;
  }
  return variation >= 0 ? "#2F9E44" : "#E03131";
}

type Props = {
  /** Données pré-chargées (ex. via /pig-price-index/dashboard). */
  hybrid?: HybridPigPriceIndexDto | null;
};

export function PigPriceIndexCard({ hybrid }: Props = {}) {
  const { t, i18n } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";

  const q = useQuery({
    queryKey: ["hybridPigPriceIndex", activeProfileId],
    queryFn: () => fetchHybridPigPriceIndex(accessToken!, activeProfileId),
    enabled: hybrid === undefined && Boolean(accessToken),
    staleTime: 3_600_000
  });

  if (hybrid === undefined && q.isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={mobileColors.accent} />
      </View>
    );
  }

  const data = hybrid !== undefined ? hybrid : q.data;
  if (!data?.price_per_kg) {
    return null;
  }

  const priceLabel = `${Math.round(data.price_per_kg).toLocaleString(locale)} ${t("pigPriceIndex.unit")}`;
  const varColor = trendColor(data.trend, data.variation_7d_pct);
  const varLabel =
    data.variation_7d_pct != null
      ? `${data.variation_7d_pct > 0 ? "+" : ""}${data.variation_7d_pct.toFixed(1)} % (7j)`
      : "—";

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("pigPriceIndexCard.title")}</Text>
        <Ionicons
          name={trendIcon(data.trend)}
          size={22}
          color={varColor}
          accessibilityLabel={data.trend}
        />
      </View>
      <Text style={styles.price}>{priceLabel}</Text>
      <Text style={[styles.variation, { color: varColor }]}>{varLabel}</Text>
      <Text style={styles.meta}>
        {formatRelativeTime(data.calculated_at, i18n.language)}
      </Text>
      <Text style={styles.basis}>
        {t("pigPriceIndexCard.basedOn", { count: data.data_points_count })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: mobileSpacing.xs
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  price: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  variation: {
    ...mobileTypography.meta,
    fontWeight: "700",
    marginTop: 2
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  basis: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  }
});
