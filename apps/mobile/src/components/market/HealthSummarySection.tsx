import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MarketplaceListingHealthData } from "../../lib/api";
import { DetailCard, DetailSectionLabel } from "../marketplace/listingDetailUi";
import { DiseaseExpandable } from "./DiseaseExpandable";
import { VaccineExpandable } from "./VaccineExpandable";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  healthData: MarketplaceListingHealthData | null | undefined;
};

function globalVaccineStatusLabel(
  status: MarketplaceListingHealthData["vaccinesStatus"],
  t: (k: string) => string
): string {
  switch (status) {
    case "up_to_date":
      return t("marketScreen.detail.health.globalVaccinesOk");
    case "overdue":
      return t("marketScreen.detail.health.globalVaccinesOverdue");
    default:
      return t("marketScreen.detail.health.globalVaccinesNone");
  }
}

export function HealthSummarySection({ healthData }: Props) {
  const { t } = useTranslation();

  if (!healthData) {
    return (
      <DetailCard>
        <DetailSectionLabel>{t("marketScreen.healthTitle")}</DetailSectionLabel>
        <Text style={styles.muted}>{t("marketScreen.detail.noHealthData")}</Text>
      </DetailCard>
    );
  }

  const animalIds = new Set(
    [
      ...healthData.vaccines.map((v) => v.animalId),
      ...healthData.pastDiseases.map((d) => d.animalId)
    ].filter(Boolean)
  );
  const multiAnimal = animalIds.size > 1;

  return (
    <DetailCard>
      <DetailSectionLabel>{t("marketScreen.healthTitle")}</DetailSectionLabel>
      <View style={styles.globalRow}>
        <Text style={styles.globalLabel}>
          {t("marketScreen.detail.health.globalStatus")}
        </Text>
        <Text style={styles.globalValue}>
          {globalVaccineStatusLabel(healthData.vaccinesStatus, t)}
        </Text>
      </View>
      <View style={styles.expandables}>
        <VaccineExpandable healthData={healthData} multiAnimal={multiAnimal} />
        <DiseaseExpandable healthData={healthData} multiAnimal={multiAnimal} />
      </View>
    </DetailCard>
  );
}

const styles = StyleSheet.create({
  muted: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  globalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  globalLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    flex: 1
  },
  globalValue: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    textAlign: "right",
    flex: 1
  },
  expandables: {
    gap: mobileSpacing.sm
  }
});
