import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { InfoRow, SectionHeader, vetPalette } from "../../components/common";
import { VetMobileShell } from "../../components/layout";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import {
  fetchFarmCheptelOverview,
  fetchFarmHealthEvents,
  fetchFarmHealthOverview,
  fetchVetAppointments,
  fetchVetConsultations
} from "../../lib/api";
import { vetColors, vetRadius } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

const TABS = ["health", "livestock", "visits", "prescriptions"] as const;
type TabId = (typeof TABS)[number];

export function VetFarmDetailScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const route = useRoute<RouteProp<RootStackParamList, "VetFarmDetail">>();
  const { farmId, farmName, initialTab } = route.params;
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId } = useSession();
  const [tab, setTab] = useState<TabId>(
    initialTab && TABS.includes(initialTab) ? initialTab : "health"
  );

  const healthQ = useQuery({
    queryKey: ["vetFarmHealth", farmId, activeProfileId],
    queryFn: () =>
      fetchFarmHealthOverview(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && tab === "health")
  });

  const diseasesQ = useQuery({
    queryKey: ["vetFarmDiseases", farmId, activeProfileId],
    queryFn: () =>
      fetchFarmHealthEvents(accessToken!, farmId, activeProfileId, {
        kind: "disease"
      }),
    enabled: Boolean(accessToken && tab === "health")
  });

  const vaccinesQ = useQuery({
    queryKey: ["vetFarmVaccines", farmId, activeProfileId],
    queryFn: () =>
      fetchFarmHealthEvents(accessToken!, farmId, activeProfileId, {
        kind: "vaccination"
      }),
    enabled: Boolean(accessToken && tab === "health")
  });

  const cheptelQ = useQuery({
    queryKey: ["vetFarmCheptel", farmId, activeProfileId],
    queryFn: () =>
      fetchFarmCheptelOverview(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && tab === "livestock")
  });

  const consultsQ = useQuery({
    queryKey: ["vetFarmConsults", farmId, activeProfileId],
    queryFn: () =>
      fetchVetConsultations(accessToken!, farmId, activeProfileId),
    enabled: Boolean(
      accessToken && (tab === "visits" || tab === "prescriptions")
    )
  });

  const appointmentsQ = useQuery({
    queryKey: ["vetAppointments", activeProfileId, "farmDetail"],
    queryFn: () => fetchVetAppointments(accessToken!, "vet", activeProfileId),
    enabled: Boolean(accessToken && tab === "visits")
  });

  const farmAppointments = useMemo(
    () => (appointmentsQ.data ?? []).filter((a) => a.farmId === farmId),
    [appointmentsQ.data, farmId]
  );

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

  return (
    <VetMobileShell hideTopBar>
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingBottom: bottomInset }]}
      >
        <Text style={styles.farmTitle}>{farmName}</Text>
        <View style={styles.tabs}>
          {TABS.map((id) => (
            <Pressable
              key={id}
              style={[styles.tab, tab === id && styles.tabOn]}
              onPress={() => setTab(id)}
            >
              <Text style={[styles.tabTx, tab === id && styles.tabTxOn]}>
                {t(`vet.farmDetail.tabs.${id}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "health" ? (
          <View style={styles.block}>
            {healthQ.isLoading ? (
              <ActivityIndicator color={vetColors.primary} />
            ) : (
              <>
                <SectionHeader
                  label={t("vet.farmDetail.alertsTitle")}
                  palette={vetPalette}
                />
                <View style={styles.card}>
                  <InfoRow
                    label={t("vet.farmDetail.activeDiseases")}
                    value={String(healthQ.data?.activeDiseaseCount ?? 0)}
                    palette={vetPalette}
                  />
                  <InfoRow
                    label={t("vet.farmDetail.overdueVaccines")}
                    value={String(healthQ.data?.overdueVaccineCount ?? 0)}
                    palette={vetPalette}
                  />
                  <InfoRow
                    label={t("vet.farmDetail.mortality30d")}
                    value={`${healthQ.data?.mortalityRate30d ?? "0"} %`}
                    palette={vetPalette}
                  />
                </View>

                <SectionHeader
                  label={t("vet.farmDetail.recentCases")}
                  palette={vetPalette}
                />
                {(diseasesQ.data ?? []).slice(0, 5).map((d) => (
                  <View key={d.id} style={styles.listCard}>
                    <Text style={styles.listTitle}>
                      {d.disease?.diagnosis ?? t("vet.farmDetail.caseFallback")}
                    </Text>
                    <Text style={styles.listMeta}>
                      {formatDate(d.occurredAt)}
                    </Text>
                  </View>
                ))}
                {(diseasesQ.data ?? []).length === 0 ? (
                  <Text style={styles.empty}>{t("vet.farmDetail.noCases")}</Text>
                ) : null}

                <SectionHeader
                  label={t("vet.farmDetail.vaccinations")}
                  palette={vetPalette}
                />
                {(vaccinesQ.data ?? []).slice(0, 5).map((v) => (
                  <View key={v.id} style={styles.listCard}>
                    <Text style={styles.listTitle}>
                      {v.vaccination?.vaccineName ??
                        t("vet.farmDetail.vaccineFallback")}
                    </Text>
                    <Text style={styles.listMeta}>
                      {formatDate(v.occurredAt)}
                    </Text>
                  </View>
                ))}

                <Pressable
                  style={styles.btn}
                  onPress={() =>
                    navigation.navigate("CreateVetConsultation", {
                      farmId,
                      farmName
                    })
                  }
                >
                  <Text style={styles.btnTx}>
                    {t("vet.farmDetail.declareCase")}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        {tab === "livestock" ? (
          <View style={styles.block}>
            {cheptelQ.isLoading ? (
              <ActivityIndicator color={vetColors.primary} />
            ) : (
              <View style={styles.card}>
                <InfoRow
                  label={t("vet.farmDetail.headcount")}
                  value={String(cheptelQ.data?.kpis.totalHeadcount ?? "—")}
                  palette={vetPalette}
                />
                <InfoRow
                  label={t("vet.farmDetail.batches")}
                  value={String(cheptelQ.data?.kpis.activeBatchesCount ?? "—")}
                  palette={vetPalette}
                />
                {(cheptelQ.data?.categoryBreakdown ?? [])
                  .slice(0, 6)
                  .map((row) => (
                    <InfoRow
                      key={row.key}
                      label={row.key}
                      value={String(row.count)}
                      palette={vetPalette}
                    />
                  ))}
                <Text style={styles.readonlyHint}>
                  {t("vet.farmDetail.livestockReadonly")}
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {tab === "visits" ? (
          <View style={styles.block}>
            {(consultsQ.isLoading || appointmentsQ.isLoading) && (
              <ActivityIndicator color={vetColors.primary} />
            )}
            <SectionHeader
              label={t("vet.farmDetail.appointments")}
              palette={vetPalette}
            />
            {farmAppointments.map((a) => (
              <Pressable
                key={a.id}
                style={styles.listCard}
                onPress={() =>
                  navigation.navigate("VetAppointmentDetail", {
                    appointmentId: a.id
                  })
                }
              >
                <Text style={styles.listTitle}>
                  {a.reason ?? t("vet.farmDetail.visitFallback")}
                </Text>
                <Text style={styles.listMeta}>
                  {a.status} ·{" "}
                  {formatDate(
                    a.scheduledAt ?? a.confirmedAt ?? a.requestedAt ?? ""
                  )}
                </Text>
              </Pressable>
            ))}
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
            {(consultsQ.data ?? []).length === 0 &&
            farmAppointments.length === 0 ? (
              <Text style={styles.empty}>{t("vet.farmDetail.noVisits")}</Text>
            ) : null}
          </View>
        ) : null}

        {tab === "prescriptions" ? (
          <View style={styles.block}>
            {consultsQ.isLoading ? (
              <ActivityIndicator color={vetColors.primary} />
            ) : (consultsQ.data ?? []).length === 0 ? (
              <Text style={styles.empty}>
                {t("vet.farmDetail.noPrescriptions")}
              </Text>
            ) : (
              (consultsQ.data ?? []).map((c) => (
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
                    {t("vet.farmDetail.reportHint")} · {formatDate(c.openedAt)}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </VetMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  farmTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: vetColors.textPrimary
  },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: vetColors.cardBg,
    borderWidth: 1,
    borderColor: vetColors.border
  },
  tabOn: { backgroundColor: vetColors.primary, borderColor: vetColors.primary },
  tabTx: { fontWeight: "600", color: vetColors.textSecondary, fontSize: 13 },
  tabTxOn: { color: vetColors.onPrimary },
  block: { gap: mobileSpacing.sm },
  card: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border,
    gap: mobileSpacing.md
  },
  listCard: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.button,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border,
    gap: 2
  },
  listTitle: {
    fontWeight: "600",
    color: vetColors.textPrimary
  },
  listMeta: { ...mobileTypography.meta, color: vetColors.textSecondary },
  empty: { color: vetColors.textSecondary, marginVertical: mobileSpacing.sm },
  readonlyHint: {
    ...mobileTypography.meta,
    color: vetColors.textMuted,
    marginTop: mobileSpacing.xs
  },
  btn: {
    backgroundColor: vetColors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: mobileSpacing.sm
  },
  btnTx: { color: vetColors.onPrimary, fontWeight: "700" }
});
