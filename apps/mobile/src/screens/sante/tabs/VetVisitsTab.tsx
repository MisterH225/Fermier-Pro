import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { formatHealthDay } from "../../../components/sante/healthUtils";
import type { FarmHealthUpcomingDto } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { HealthKindListTab } from "./HealthKindListTab";
import type { ComponentProps } from "react";

type ListProps = Omit<
  ComponentProps<typeof HealthKindListTab>,
  "kind" | "prependContent"
>;

type Props = ListProps & {
  upcoming: FarmHealthUpcomingDto | undefined;
  locale: string;
};

export function VetVisitsTab({ upcoming, locale, ...listProps }: Props) {
  const { t } = useTranslation();
  const next = upcoming?.vetVisits?.[0];

  const prepend = next ? (
    <View style={styles.highlight}>
      <Text style={styles.highlightLabel}>
        {t("health.vetVisits.nextPlanned")}
      </Text>
      <Text style={styles.highlightTitle}>
        {next.vetVisit?.vetName ?? "—"} · {next.vetVisit?.reason ?? ""}
      </Text>
      <Text style={styles.highlightMeta}>
        {formatHealthDay(next.occurredAt, locale)}
      </Text>
    </View>
  ) : null;

  return (
    <HealthKindListTab
      kind="vet_visit"
      locale={locale}
      prependContent={prepend}
      showSubjectPicker={false}
      {...listProps}
    />
  );
}

const styles = StyleSheet.create({
  highlight: {
    backgroundColor: "#EFF6FF",
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.md,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    ...mobileShadows.card
  },
  highlightLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  highlightTitle: {
    ...mobileTypography.cardTitle,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  highlightMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  }
});
