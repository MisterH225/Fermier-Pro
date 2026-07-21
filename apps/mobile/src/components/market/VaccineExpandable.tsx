import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MarketplaceListingHealthData } from "../../lib/api";
import { ExpandableSection, type ExpandableBadge } from "../common/ExpandableSection";
import { mobileColors, mobileSpacing, mobileTypography, mobileStatusSurfaces, mobileFontSize } from "../../theme/mobileTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

type Props = {
  healthData: MarketplaceListingHealthData;
  multiAnimal: boolean;
};

function vaccineBadge(
  status: MarketplaceListingHealthData["vaccinesStatus"],
  t: (k: string) => string
): ExpandableBadge {
  switch (status) {
    case "up_to_date":
      return {
        label: t("marketScreen.detail.health.vaccinesBadgeOk"),
        color: mobileStatusSurfaces.successBg,
        textColor: mobileStatusSurfaces.successText
      };
    case "overdue":
      return {
        label: t("marketScreen.detail.health.vaccinesBadgeOverdue"),
        color: mobileStatusSurfaces.errorBg,
        textColor: uiNamedColors.c991B1B
      };
    default:
      return {
        label: t("marketScreen.detail.health.vaccinesBadgeNone"),
        color: uiNamedColors.cF3F4F6,
        textColor: mobileColors.textSecondary
      };
  }
}

function rowStatusIcon(status: "done" | "upcoming" | "overdue"): string {
  switch (status) {
    case "done":
      return "✅";
    case "upcoming":
      return "⏳";
    case "overdue":
      return "🔴";
    default:
      return "•";
  }
}

function rowStatusLabel(
  status: "done" | "upcoming" | "overdue",
  t: (k: string) => string
): string {
  switch (status) {
    case "done":
      return t("marketScreen.detail.health.vaccineDone");
    case "upcoming":
      return t("marketScreen.detail.health.vaccineUpcoming");
    case "overdue":
      return t("marketScreen.detail.health.vaccineOverdue");
    default:
      return "";
  }
}

export function VaccineExpandable({ healthData, multiAnimal }: Props) {
  const { t } = useTranslation();
  const vaccines = healthData.vaccines;

  const grouped = multiAnimal
    ? vaccines.reduce<Record<string, typeof vaccines>>((acc, row) => {
        const key = row.animalLabel;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(row);
        return acc;
      }, {})
    : { "": vaccines };

  return (
    <ExpandableSection
      title={t("marketScreen.detail.health.vaccinesTitle")}
      badge={vaccineBadge(healthData.vaccinesStatus, t)}
      defaultExpanded={false}
    >
      {vaccines.length === 0 ? (
        <Text style={styles.empty}>
          {t("marketScreen.detail.health.vaccinesEmpty")}
        </Text>
      ) : (
        Object.entries(grouped).map(([animalLabel, rows]) => (
          <View key={animalLabel || "single"} style={styles.group}>
            {multiAnimal && animalLabel ? (
              <Text style={styles.groupTitle}>{animalLabel}</Text>
            ) : null}
            {rows.map((row, idx) => (
              <View
                key={`${row.vaccineName}-${row.administeredDate}-${idx}`}
                style={[styles.row, idx < rows.length - 1 && styles.rowBorder]}
              >
                <Text style={styles.rowIcon}>{rowStatusIcon(row.status)}</Text>
                <View style={styles.rowBody}>
                  <Text style={styles.rowName}>{row.vaccineName}</Text>
                  <Text style={styles.rowDate}>
                    {new Date(row.administeredDate).toLocaleDateString("fr-FR")}
                  </Text>
                </View>
                <Text style={styles.rowStatus}>
                  {rowStatusLabel(row.status, t)}
                </Text>
              </View>
            ))}
          </View>
        ))
      )}
    </ExpandableSection>
  );
}

const styles = StyleSheet.create({
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
    fontSize: mobileFontSize.sm
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingVertical: 8
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  rowIcon: { fontSize: mobileFontSize.lg, width: 24 },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: {
    ...mobileTypography.body,
    fontWeight: "700",
    fontSize: mobileFontSize.md,
    color: mobileColors.textPrimary
  },
  rowDate: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  rowStatus: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    maxWidth: 88,
    textAlign: "right"
  }
});
