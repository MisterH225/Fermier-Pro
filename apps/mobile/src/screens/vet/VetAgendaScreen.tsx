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
import { useVetBottomChromePad } from "../../context/VetBottomChromeContext";
import { useSession } from "../../context/SessionContext";
import { fetchVetDashboard, fetchVetProfileMe } from "../../lib/api";
import { vetColors, vetRadius, vetShadow } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

export function VetAgendaScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomPad = useVetBottomChromePad();
  const { accessToken, activeProfileId } = useSession();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [listView, setListView] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [scheduleOpen, setScheduleOpen] = useState(false);

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

  const events: EventItem[] = useMemo(
    () =>
      (dashQ.data?.upcomingVisits ?? []).map((v) => ({
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
    [dashQ.data?.upcomingVisits, locale]
  );

  const firstVisit = dashQ.data?.upcomingVisits[0];

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
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: bottomPad + 16 }]}>
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
                onPress={() =>
                  navigation.navigate("VetConsultationDetail", {
                    farmId: firstVisit.farmId,
                    farmName: firstVisit.farmName,
                    consultationId: firstVisit.id
                  })
                }
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
              const v = dashQ.data?.upcomingVisits.find((x) => x.id === item.id);
              if (!v) return;
              navigation.navigate("VetConsultationDetail", {
                farmId: v.farmId,
                farmName: v.farmName,
                consultationId: v.id
              });
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
  toggle: { fontSize: 20, paddingHorizontal: 8 },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  navBtn: { fontSize: 22, color: vetColors.primary, padding: 8 },
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
  dayName: { fontSize: 11, color: vetColors.textSecondary },
  dayNameActive: { color: "rgba(255,255,255,0.9)" },
  dayNum: { fontSize: 16, fontWeight: "700", color: vetColors.textPrimary },
  dayNumActive: { color: "#fff" },
  sectionTitle: {
    fontSize: 16,
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
  periodTxOn: { color: "#fff" },
  slots: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: mobileSpacing.sm
  },
  slot: {
    width: "30%",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: vetColors.cardBg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: vetColors.border
  },
  slotOccupied: { backgroundColor: "#6B7280", borderColor: "#6B7280" },
  slotSelected: { backgroundColor: vetColors.primary, borderColor: vetColors.primary },
  slotTx: { fontWeight: "600", color: vetColors.textPrimary },
  slotTxInv: { color: "#fff" },
  bookBtn: {
    marginTop: mobileSpacing.lg,
    backgroundColor: vetColors.primary,
    borderRadius: vetRadius.search,
    paddingVertical: 16,
    alignItems: "center",
    ...vetShadow.soft
  },
  bookBtnDisabled: { opacity: 0.45 },
  bookBtnTx: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
