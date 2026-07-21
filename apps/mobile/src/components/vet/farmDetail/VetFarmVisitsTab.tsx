import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SectionHeader, vetPalette } from "../../common";
import { VetEmptyState } from "./VetEmptyState";
import { useSession } from "../../../context/SessionContext";
import { fetchVetAppointments, fetchVetConsultations } from "../../../lib/api";
import { vetColors, vetRadius, vetShadow } from "../../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../../theme/mobileTheme";
import type { RootStackParamList } from "../../../types/navigation";

const PENDING_STATUSES = new Set([
  "APPOINTMENT_REQUESTED",
  "AWAITING_PAYMENT"
]);

type Props = {
  farmId: string;
  farmName: string;
  locale: string;
};

export function VetFarmVisitsTab({ farmId, farmName, locale }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId } = useSession();

  const consultsQ = useQuery({
    queryKey: ["vetFarmConsults", farmId, activeProfileId],
    queryFn: () =>
      fetchVetConsultations(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const appointmentsQ = useQuery({
    queryKey: ["vetAppointments", activeProfileId, "farmDetail", farmId],
    queryFn: () =>
      fetchVetAppointments(accessToken!, "vet", activeProfileId, farmId),
    enabled: Boolean(accessToken)
  });

  const farmAppointments = useMemo(() => {
    const rows = appointmentsQ.data ?? [];
    return [...rows].sort((a, b) => {
      const ap = PENDING_STATUSES.has(a.status) ? 0 : 1;
      const bp = PENDING_STATUSES.has(b.status) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      const at = new Date(
        a.scheduledAt ?? a.confirmedAt ?? a.requestedAt
      ).getTime();
      const bt = new Date(
        b.scheduledAt ?? b.confirmedAt ?? b.requestedAt
      ).getTime();
      return bt - at;
    });
  }, [appointmentsQ.data]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const statusLabel = (status: string) => {
    if (status === "AWAITING_PAYMENT") {
      return t("vet.farmDetail.statusAwaitingPayment");
    }
    if (status === "APPOINTMENT_REQUESTED") {
      return t("vet.farmDetail.statusRequested");
    }
    return status;
  };

  if (consultsQ.isLoading || appointmentsQ.isLoading) {
    return <ActivityIndicator color={vetColors.primary} />;
  }

  return (
    <View style={styles.block}>
      <SectionHeader
        label={t("vet.farmDetail.appointments")}
        palette={vetPalette}
      />
      {farmAppointments.map((a) => {
        const pending = PENDING_STATUSES.has(a.status);
        return (
          <Pressable
            key={a.id}
            style={[styles.listCard, pending && styles.pendingCard]}
            onPress={() =>
              navigation.navigate("VetAppointmentDetail", {
                appointmentId: a.id
              })
            }
          >
            <View style={styles.row}>
              <Text style={styles.listTitle} numberOfLines={2}>
                {a.reason || t("vet.farmDetail.visitFallback")}
              </Text>
              {pending ? (
                <Text style={styles.pendingTag}>
                  {t("vet.farmDetail.pendingQuote")}
                </Text>
              ) : null}
            </View>
            <Text style={styles.listMeta}>
              {statusLabel(a.status)} ·{" "}
              {formatDate(
                a.scheduledAt ?? a.confirmedAt ?? a.requestedAt ?? ""
              )}
            </Text>
          </Pressable>
        );
      })}

      <SectionHeader
        label={t("vet.farmDetail.consultations")}
        palette={vetPalette}
      />
      {(consultsQ.data ?? []).map((c) => (
        <Pressable
          key={c.id}
          style={styles.listCard}
          onPress={() =>
            navigation.navigate("VetConsultationDetail", {
              farmId,
              farmName,
              consultationId: c.id
            })
          }
        >
          <Text style={styles.listTitle}>{c.subject}</Text>
          <Text style={styles.listMeta}>
            {c.status} · {formatDate(c.openedAt)}
          </Text>
        </Pressable>
      ))}

      {(consultsQ.data ?? []).length === 0 && farmAppointments.length === 0 ? (
        <VetEmptyState
          icon="calendar-outline"
          message={t("vet.farmDetail.noVisits")}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: mobileSpacing.sm },
  listCard: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.md,
    gap: 2,
    ...vetShadow.soft
  },
  pendingCard: {
    borderLeftWidth: 4,
    borderLeftColor: vetColors.warning,
    backgroundColor: vetColors.kpiAmber
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "flex-start"
  },
  listTitle: { flex: 1, fontWeight: "600", color: vetColors.textPrimary },
  listMeta: { ...mobileTypography.meta, color: vetColors.textSecondary },
  pendingTag: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: vetColors.warning,
    fontSize: 11
  }
});
