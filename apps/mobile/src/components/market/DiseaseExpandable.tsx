import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MarketplaceListingHealthData } from "../../lib/api";
import { ExpandableSection, type ExpandableBadge } from "../common/ExpandableSection";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  healthData: MarketplaceListingHealthData;
  multiAnimal: boolean;
};

function diseaseBadge(
  healthData: MarketplaceListingHealthData,
  t: (k: string) => string
): ExpandableBadge {
  if (healthData.pastDiseases.length === 0) {
    return {
      label: t("marketScreen.detail.health.diseasesBadgeNone"),
      color: "#DCFCE7",
      textColor: "#166534"
    };
  }
  return {
    label: t("marketScreen.detail.health.diseasesBadgeCount", {
      count: healthData.pastDiseases.length
    }),
    color: "#FFEDD5",
    textColor: "#9A3412"
  };
}

export function DiseaseExpandable({ healthData, multiAnimal }: Props) {
  const { t } = useTranslation();
  const diseases = healthData.pastDiseases;

  const grouped = multiAnimal
    ? diseases.reduce<Record<string, typeof diseases>>((acc, row) => {
        const key = row.animalLabel;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(row);
        return acc;
      }, {})
    : { "": diseases };

  return (
    <ExpandableSection
      title={t("marketScreen.detail.health.diseasesTitle")}
      badge={diseaseBadge(healthData, t)}
      defaultExpanded={false}
    >
      {healthData.activeCasesCount > 0 ? (
        <Text style={styles.activeWarning}>
          {t("marketScreen.detail.health.activeCasesWarning", {
            count: healthData.activeCasesCount
          })}
        </Text>
      ) : null}
      {diseases.length === 0 ? (
        <Text style={styles.empty}>
          {t("marketScreen.detail.health.diseasesEmpty")}
        </Text>
      ) : (
        Object.entries(grouped).map(([animalLabel, rows]) => (
          <View key={animalLabel || "single"} style={styles.group}>
            {multiAnimal && animalLabel ? (
              <Text style={styles.groupTitle}>{animalLabel}</Text>
            ) : null}
            {rows.map((row, idx) => {
              const title =
                row.diagnosis?.trim() || row.symptomsSummary;
              const from = new Date(row.onsetDate).toLocaleDateString("fr-FR");
              const to = new Date(row.resolvedDate).toLocaleDateString(
                "fr-FR"
              );
              const statusLabel =
                row.finalStatus === "recovered"
                  ? t("marketScreen.detail.health.statusRecovered")
                  : t("marketScreen.detail.health.statusResolved");
              return (
                <View
                  key={`${row.onsetDate}-${idx}`}
                  style={[styles.row, idx < rows.length - 1 && styles.rowBorder]}
                >
                  <Text style={styles.rowIcon}>✅</Text>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName} numberOfLines={2}>
                      {title}
                    </Text>
                    <Text style={styles.rowPeriod}>
                      {t("marketScreen.detail.health.diseasePeriod", {
                        from,
                        to
                      })}
                    </Text>
                    <Text style={styles.rowStatus}>{statusLabel}</Text>
                  </View>
                  <Text style={styles.rowDuration}>
                    {t("marketScreen.detail.health.diseaseDuration", {
                      days: row.durationDays
                    })}
                  </Text>
                </View>
              );
            })}
          </View>
        ))
      )}
    </ExpandableSection>
  );
}

const styles = StyleSheet.create({
  activeWarning: {
    ...mobileTypography.meta,
    fontWeight: "800",
    color: "#B45309",
    marginBottom: mobileSpacing.sm
  },
  empty: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontStyle: "italic",
    paddingBottom: mobileSpacing.sm
  },
  group: { marginBottom: mobileSpacing.sm },
  groupTitle: {
    ...mobileTypography.meta,
    fontWeight: "800",
    color: mobileColors.accent,
    marginBottom: 6,
    fontSize: 12
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.sm,
    paddingVertical: 8
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  rowIcon: { fontSize: 16, width: 24, marginTop: 2 },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: {
    ...mobileTypography.body,
    fontWeight: "700",
    fontSize: 14,
    color: mobileColors.textPrimary
  },
  rowPeriod: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  rowStatus: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    marginTop: 4,
    fontWeight: "600"
  },
  rowDuration: {
    ...mobileTypography.meta,
    fontSize: 11,
    color: mobileColors.textSecondary,
    maxWidth: 72,
    textAlign: "right"
  }
});
