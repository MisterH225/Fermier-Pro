import { useLayoutEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { CardContentSkeleton } from "../../components/common/SkeletonBlocks";
import { EventList } from "../../components/lists/EventList";
import type { EventItem } from "../../components/lists/types";
import { VetMobileShell } from "../../components/layout";
import { ScheduleVisitModal } from "../../components/vet/ScheduleVisitModal";
import { VisitCard } from "../../components/vet/VisitCard";
import { VisitSlotPicker } from "../../components/vet/VisitSlotPicker";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import { fetchVetDashboard, fetchVetProfileMe } from "../../lib/api";
import { vetColors, vetRadius, vetShadow } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography, mobileColors, mobileRadius, mobileFontSize } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

export function VetAgendaScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId } = useSession();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [listView, setListView] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [farmFilterId, setFarmFilterId] = useState<string | null>(null);

  const dashQ = useQuery({
    queryKey: ["vetDashboard", activeProfileId, "agenda"],
    queryFn: () => fetchVetDashboard(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const profileQ = useQuery({
    queryKey: ["vetProfileMe", activeProfileId, "agenda"],
    queryFn: () => fetchVetProfileMe(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const weekDays = useMemo(() => {
    const start = new Date(selectedDay);
    start.setDate(start.getDate() - start.getDay() + 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [selectedDay]);

  const assignedFarms = dashQ.data?.assignedFarms ?? [];
  const filteredVisits = useMemo(() => {
    const all = dashQ.data?.upcomingVisits ?? [];
    if (!farmFilterId) return all;
    return all.filter((v) => v.farmId === farmFilterId);
  }, [dashQ.data?.upcomingVisits, farmFilterId]);

  const events: EventItem[] = useMemo(
    () =>
      filteredVisits.map((v) => ({
        id: v.id,
        title: v.subject,
        subtitle: `${v.farmName} · ${v.producerName ?? ""}`,
        date: new Date(v.scheduledAt).toLocaleString(locale, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        }),
        valueType: "neutral" as const,
        iconType: "custom" as const,
        customIcon: "calendar-outline",
        iconColor: vetColors.primary
      })),
    [filteredVisits, locale]
  );

  const firstVisit = filteredVisits[0];

  const openUpcomingVisit = (
    v: NonNullable<typeof dashQ.data>["upcomingVisits"][number]
  ) => {
    if (v.kind === "appointment") {
      navigation.navigate("VetAppointmentDetail", { appointmentId: v.id });
      return;
    }
    navigation.navigate("VetConsultationDetail", {
      farmId: v.farmId,
      farmName: v.farmName,
      consultationId: v.id
    });
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => setListView((v) => !v)} style={{ paddingHorizontal: 12 }}>
          <Text style={styles.toggle}>{listView ? "📅" : "📋"}</Text>
        </Pressable>
      )
    });
  }, [navigation, listView]);

  return (
    <VetMobileShell hideTopBar>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: bottomInset }]}>
        {assignedFarms.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.farmFilter}
          >
            <Pressable
              style={[styles.farmChip, !farmFilterId && styles.farmChipOn]}
              onPress={() => setFarmFilterId(null)}
            >
              <Text
                style={[
                  styles.farmChipTx,
                  !farmFilterId && styles.farmChipTxOn
                ]}
              >
                {t("vet.agenda.filterAllFarms")}
              </Text>
            </Pressable>
            {assignedFarms.map((f) => (
              <Pressable
                key={f.id}
                style={[
                  styles.farmChip,
                  farmFilterId === f.id && styles.farmChipOn
                ]}
                onPress={() => setFarmFilterId(f.id)}
              >
                <Text
                  style={[
                    styles.farmChipTx,
                    farmFilterId === f.id && styles.farmChipTxOn
                  ]}
                  numberOfLines={1}
                >
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {!listView ? (
          <>
            <View style={styles.monthRow}>
              <Pressable
                onPress={() => {
                  const d = new Date(selectedDay);
                  d.setMonth(d.getMonth() - 1);
                  setSelectedDay(d);
                }}
              >
                <Text style={styles.navBtn}>←</Text>
              </Pressable>
              <Text style={styles.monthLabel}>
                {selectedDay.toLocaleDateString(locale, { month: "long", year: "numeric" })}
              </Text>
              <Pressable
                onPress={() => {
                  const d = new Date(selectedDay);
                  d.setMonth(d.getMonth() + 1);
                  setSelectedDay(d);
                }}
              >
                <Text style={styles.navBtn}>→</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
              {weekDays.map((d) => {
                const active =
                  d.toDateString() === selectedDay.toDateString();
                return (
                  <Pressable
                    key={d.toISOString()}
                    style={[styles.dayCell, active && styles.dayCellActive]}
                    onPress={() => {
                      setSelectedDay(d);
                      setSelectedSlot(null);
                    }}
                  >
                    <Text style={[styles.dayName, active && styles.dayNameActive]}>
                      {d.toLocaleDateString(locale, { weekday: "short" })}
                    </Text>
                    <Text style={[styles.dayNum, active && styles.dayNumActive]}>
                      {d.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {firstVisit ? (
              <VisitCard
                farmName={firstVisit.farmName}
                producerName={firstVisit.producerName}
                producerPhone={firstVisit.producerPhone}
                scheduledAt={firstVisit.scheduledAt}
                subject={firstVisit.subject}
                location={firstVisit.location}
                onPress={() => openUpcomingVisit(firstVisit)}
              />
            ) : null}

            {profileQ.data?.id && accessToken ? (
              <VisitSlotPicker
                vetProfileId={profileQ.data.id}
                selectedDay={selectedDay}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
                accessToken={accessToken}
                activeProfileId={activeProfileId}
              />
            ) : (
              <CardContentSkeleton lines={4} />
            )}
            <Pressable
              style={[styles.bookBtn, !selectedSlot && styles.bookBtnDisabled]}
              disabled={!selectedSlot}
              onPress={() => setScheduleOpen(true)}
            >
              <Text style={styles.bookBtnTx}>{t("vet.agenda.bookNow")}</Text>
            </Pressable>
          </>
        ) : (
          <EventList
            data={events}
            layout="embedded"
            emptyMessage={t("vet.agenda.empty")}
            onItemPress={(item) => {
              const v = filteredVisits.find((x) => x.id === item.id);
              if (!v) return;
              openUpcomingVisit(v);
            }}
          />
        )}
      </ScrollView>
      <ScheduleVisitModal
        visible={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        selectedDay={selectedDay}
        selectedSlot={selectedSlot}
      />
    </VetMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  farmFilter: { marginBottom: mobileSpacing.xs, maxHeight: 44 },
  farmChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    backgroundColor: vetColors.cardBg,
    borderWidth: 1,
    borderColor: vetColors.border,
    marginRight: 8
  },
  farmChipOn: {
    backgroundColor: vetColors.primary,
    borderColor: vetColors.primary
  },
  farmChipTx: { fontWeight: "600", color: vetColors.textSecondary, fontSize: mobileFontSize.sm },
  farmChipTxOn: { color: vetColors.onPrimary },
  toggle: { fontSize: mobileFontSize.xl, paddingHorizontal: 8 },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  navBtn: { fontSize: mobileFontSize.xl, color: vetColors.primary, padding: 8 },
  monthLabel: {
    ...mobileTypography.title,
    fontWeight: "700",
    color: vetColors.textPrimary
  },
  strip: { marginVertical: mobileSpacing.sm },
  dayCell: {
    alignItems: "center",
    padding: 10,
    marginRight: 8,
    borderRadius: vetRadius.day,
    minWidth: 48,
    backgroundColor: vetColors.cardBg
  },
  dayCellActive: { backgroundColor: vetColors.primary },
  dayName: { fontSize: mobileFontSize.xs, color: vetColors.textSecondary },
  dayNameActive: { color: "rgba(255,255,255,0.9)" },
  dayNum: { fontSize: mobileFontSize.lg, fontWeight: "700", color: vetColors.textPrimary },
  dayNumActive: { color: mobileColors.background },
  sectionTitle: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: vetColors.textPrimary,
    marginTop: mobileSpacing.md
  },
  periodRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  periodPill: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: 12,
    borderRadius: vetRadius.button,
    backgroundColor: vetColors.cardBg,
    borderWidth: 1,
    borderColor: vetColors.border,
    alignItems: "center"
  },
  periodPillOn: { backgroundColor: vetColors.primary, borderColor: vetColors.primary },
  periodTx: { fontWeight: "600", color: vetColors.textSecondary },
  periodTxOn: { color: mobileColors.background },
  slots: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: mobileSpacing.sm
  },
  slot: {
    width: "30%",
    paddingVertical: 12,
    borderRadius: mobileRadius.md,
    backgroundColor: vetColors.cardBg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: vetColors.border
  },
  slotOccupied: {
    backgroundColor: vetColors.slotOccupied,
    borderColor: vetColors.slotOccupied
  },
  slotSelected: { backgroundColor: vetColors.primary, borderColor: vetColors.primary },
  slotTx: { fontWeight: "600", color: vetColors.textPrimary },
  slotTxInv: { color: mobileColors.background },
  bookBtn: {
    marginTop: mobileSpacing.lg,
    backgroundColor: vetColors.primary,
    borderRadius: vetRadius.search,
    paddingVertical: 16,
    alignItems: "center",
    ...vetShadow.soft
  },
  bookBtnDisabled: { opacity: 0.45 },
  bookBtnTx: { color: mobileColors.background, fontWeight: "700", fontSize: mobileFontSize.lg }
});
