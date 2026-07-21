import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { fetchVetAppointments, type VetAppointmentDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { vetColors } from "../../theme/vetTheme";
import type { RootStackParamList } from "../../types/navigation";

const ACTION_STATUSES = new Set([
  "APPOINTMENT_REQUESTED",
  "VISIT_PROPOSED",
  "AWAITING_PAYMENT",
  "APPOINTMENT_CONFIRMED",
  "APPOINTMENT_IN_PROGRESS"
]);

type Props = {
  accessToken: string;
  activeProfileId?: string | null;
  farmId?: string;
};

function statusLabel(
  status: string,
  t: (key: string) => string
): string {
  if (status === "APPOINTMENT_REQUESTED") {
    return t("producer.vetAppointments.waitingForVet");
  }
  if (status === "VISIT_PROPOSED") {
    return t("producer.vetAppointments.reviewProposal");
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
  const key = `vet.appointment.status.${status}`;
  const label = t(key);
  return label === key ? status.replace(/_/g, " ") : label;
}

function formatWhen(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function VetAppointmentActionsBanner({
  accessToken,
  activeProfileId,
  farmId
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const q = useQuery({
    queryKey: ["vetAppointments", activeProfileId, "producer", "banner"],
    queryFn: () => fetchVetAppointments(accessToken, "producer", activeProfileId),
    enabled: Boolean(accessToken)
  });

  const pending = (q.data ?? []).filter(
    (a: VetAppointmentDto) =>
      ACTION_STATUSES.has(a.status) &&
      (!farmId || a.farmId === farmId)
  );

  if (pending.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("producer.vetAppointments.title")}</Text>
      {pending.map((appt) => (
        <Pressable
          key={appt.id}
          style={styles.card}
          onPress={() =>
            navigation.navigate("VetAppointmentDetail", {
              appointmentId: appt.id
            })
          }
        >
          <View style={styles.row}>
            <Text style={styles.vetName} numberOfLines={1}>
              {appt.vetName ?? t("producer.vetAppointments.vetFallback")}
            </Text>
            <Text style={styles.cta}>{statusLabel(appt.status, t)} →</Text>
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {appt.farmName ?? "—"} ·{" "}
            {formatWhen(appt.confirmedAt ?? appt.requestedAt, locale)}
          </Text>
          {appt.status === "VISIT_PROPOSED" ||
          appt.status === "AWAITING_PAYMENT" ? (
            appt.isFree ? (
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeTx}>
                  {t("producer.vetAppointments.freeBadge")}
                </Text>
              </View>
            ) : appt.servicePrice != null ? (
              <Text style={styles.price}>
                {Math.round(appt.servicePrice).toLocaleString("fr-FR")}{" "}
                {appt.currency}
              </Text>
            ) : null
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.md
  },
  title: {
    ...mobileTypography.title,
    fontSize: 17
  },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    gap: 4
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: mobileSpacing.sm
  },
  vetName: {
    ...mobileTypography.body,
    fontWeight: "700",
    flex: 1
  },
  cta: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  price: {
    ...mobileTypography.title,
    fontSize: 18,
    fontWeight: "700",
    color: vetColors.warningDeep,
    marginTop: 2
  },
  freeBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: mobileRadius.sm,
    backgroundColor: "#DCFCE7"
  },
  freeBadgeTx: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D"
  }
});
