import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  formatHealthDay,
  isUpcomingPlannedVetVisit
} from "../../../components/sante/healthUtils";
import { VetVisitQuotesPanel } from "../../../components/sante/VetVisitQuotesPanel";
import { VetAppointmentActionsBanner } from "../../../components/vet/VetAppointmentActionsBanner";
import type { FarmHealthUpcomingDto } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import type { RootStackParamList } from "../../../types/navigation";
import { HealthKindListTab } from "./HealthKindListTab";
import type { ComponentProps } from "react";

type ListProps = Omit<
  ComponentProps<typeof HealthKindListTab>,
  "kind" | "prependContent"
>;

type Props = ListProps & {
  upcoming: FarmHealthUpcomingDto | undefined;
  locale: string;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  initialOpenVisitId?: string;
  onDeleteVisit?: (recordId: string) => void;
};

function appointmentStatusLabel(
  status: string,
  t: (key: string) => string
): string {
  if (status === "APPOINTMENT_REQUESTED") {
    return t("producer.vetAppointments.waitingForVet");
  }
  if (status === "AWAITING_PAYMENT") {
    return t("producer.vetAppointments.payNow");
  }
  if (
    status === "APPOINTMENT_CONFIRMED" ||
    status === "APPOINTMENT_IN_PROGRESS"
  ) {
    return t("producer.vetAppointments.confirmService");
  }
  return status.replace(/_/g, " ");
}

export function VetVisitsTab({
  upcoming,
  locale,
  farmId,
  accessToken,
  activeProfileId,
  initialOpenVisitId,
  onDeleteVisit,
  ...listProps
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const next = upcoming?.vetVisits?.find((v) =>
    isUpcomingPlannedVetVisit(v.occurredAt, v.status)
  );
  const pendingAppointments = upcoming?.vetAppointments ?? [];

  const confirmDelete = (recordId: string) => {
    Alert.alert(
      t("health.deleteVisitTitle"),
      t("health.deleteVisitBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => onDeleteVisit?.(recordId)
        }
      ]
    );
  };

  const prepend = (
    <>
      <VetAppointmentActionsBanner
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        farmId={farmId}
      />
      <VetVisitQuotesPanel
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
      />
      {pendingAppointments.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("health.vetVisits.pendingAppointments")}
          </Text>
          {pendingAppointments.map((appt) => (
            <Pressable
              key={appt.id}
              style={styles.apptCard}
              onPress={() =>
                navigation.navigate("VetAppointmentDetail", {
                  appointmentId: appt.id
                })
              }
            >
              <Text style={styles.apptTitle} numberOfLines={1}>
                {appt.vetName ?? t("producer.vetAppointments.vetFallback")}
              </Text>
              <Text style={styles.apptMeta} numberOfLines={2}>
                {formatHealthDay(appt.confirmedAt ?? appt.requestedAt, locale)}
                {appt.reason ? ` · ${appt.reason}` : ""}
              </Text>
              <Text style={styles.apptStatus}>
                {appointmentStatusLabel(appt.status, t)} →
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {next ? (
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
          {onDeleteVisit ? (
            <Pressable
              style={styles.deleteBtn}
              onPress={() => confirmDelete(next.id)}
            >
              <Text style={styles.deleteBtnText}>
                {t("health.deleteVisitCta")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );

  return (
    <HealthKindListTab
      kind="vet_visit"
      locale={locale}
      prependContent={prepend}
      showSubjectPicker={false}
      initialOpenRecordId={initialOpenVisitId}
      {...listProps}
    />
  );
}

const styles = StyleSheet.create({
  section: {
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.md
  },
  sectionTitle: {
    ...mobileTypography.title,
    fontSize: 16
  },
  apptCard: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    gap: 4
  },
  apptTitle: {
    ...mobileTypography.body,
    fontWeight: "700"
  },
  apptMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  apptStatus: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  },
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
  },
  deleteBtn: {
    marginTop: mobileSpacing.sm,
    alignSelf: "flex-start"
  },
  deleteBtnText: {
    ...mobileTypography.meta,
    color: "#D64545",
    fontWeight: "700"
  }
});
