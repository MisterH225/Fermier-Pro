import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { VisitSlotPicker } from "../components/vet/VisitSlotPicker";
import { MobileAppShell } from "../components/layout";
import { useModal } from "../components/modals/useModal";
import { useSession } from "../context/SessionContext";
import { useScreenTitle } from "../hooks/useScreenTitle";
import {
  fetchVetPublicProfile,
  scheduleVetVisitFromProducer,
  type VetVisitReason
} from "../lib/api";
import { formatApiError } from "../lib/apiErrors";
import { openPhoneCall } from "../lib/phone";
import { combineDayAndSlot } from "../lib/visitSlots";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";
import { useBottomInset } from "../hooks/useBottomInset";

type Props = NativeStackScreenProps<RootStackParamList, "ProducerScheduleVetVisit">;

const REASONS: VetVisitReason[] = [
  "routine",
  "urgency",
  "followup",
  "vaccination",
  "other"
];

export function ProducerScheduleVetVisitScreen({ route, navigation }: Props) {
  const bottomInset = useBottomInset();
  const { farmId, farmName, vetProfileId } = route.params;
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const qc = useQueryClient();
  const modal = useModal();
  const { accessToken, activeProfileId } = useSession();

  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState<VetVisitReason>("routine");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const profileQ = useQuery({
    queryKey: ["vetPublicProfile", vetProfileId, activeProfileId],
    queryFn: () =>
      fetchVetPublicProfile(accessToken!, vetProfileId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  useScreenTitle(
    navigation,
    profileQ.data?.fullName
      ? t("health.scheduleVet.titleWithName", { name: profileQ.data.fullName })
      : t("health.scheduleVet.title")
  );

  useLayoutEffect(() => {
    if (!profileQ.data?.professionalPhone) {
      return;
    }
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() =>
            void openPhoneCall(profileQ.data!.professionalPhone, {
              errorTitle: t("health.scheduleVet.callErrorTitle"),
              errorMessage: t("health.scheduleVet.callError")
            })
          }
          style={{ paddingHorizontal: 10 }}
        >
          <Text style={{ color: mobileColors.onAccent, fontWeight: "600" }}>📞</Text>
        </Pressable>
      )
    });
  }, [navigation, profileQ.data, t]);

  const weekDays = (() => {
    const start = new Date(selectedDay);
    start.setDate(start.getDate() - start.getDay() + 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  })();

  const scheduleMut = useMutation({
    mutationFn: async () => {
      if (!selectedSlot) {
        throw new Error(t("health.scheduleVet.pickSlot"));
      }
      return scheduleVetVisitFromProducer(
        accessToken!,
        farmId,
        activeProfileId,
        {
          vetProfileId,
          scheduledAt: combineDayAndSlot(selectedDay, selectedSlot),
          reason,
          notes: notes.trim() || undefined
        }
      );
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["vetDashboard"] });
      await qc.invalidateQueries({ queryKey: ["farmHealth"] });
      await qc.invalidateQueries({ queryKey: ["vetAppointments"] });
      modal.open("success", {
        title: t("health.scheduleVet.successTitle"),
        message: t("health.scheduleVet.successBody", {
          vet: profileQ.data?.fullName ?? "—"
        }),
        autoDismissMs: 3200
      });
      if (res.id) {
        navigation.navigate("VetAppointmentDetail", { appointmentId: res.id });
      } else {
        navigation.navigate("FarmHealth", { farmId, farmName });
      }
    },
    onError: (e) => setError(formatApiError(e))
  });

  const vet = profileQ.data;

  return (
    <MobileAppShell hideTopBar>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: bottomInset }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.farmLabel}>
          {t("health.scheduleVet.farm")} · {farmName}
        </Text>
        {profileQ.isPending ? (
          <ActivityIndicator color={mobileColors.accent} />
        ) : vet ? (
          <View style={styles.vetCard}>
            <Text style={styles.vetName}>{vet.fullName}</Text>
            <Text style={styles.vetMeta}>{vet.primarySpecialty}</Text>
            <Text style={styles.vetMeta}>{vet.locationLabel}</Text>
            {!vet.availability ? (
              <Text style={styles.warn}>{t("health.scheduleVet.vetUnavailable")}</Text>
            ) : null}
          </View>
        ) : null}

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
            {selectedDay.toLocaleDateString(locale, {
              month: "long",
              year: "numeric"
            })}
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {weekDays.map((d) => {
            const active = d.toDateString() === selectedDay.toDateString();
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

        {accessToken ? (
          <VisitSlotPicker
            vetProfileId={vetProfileId}
            selectedDay={selectedDay}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            accessToken={accessToken}
            activeProfileId={activeProfileId}
            accent="producer"
          />
        ) : null}

        <Text style={styles.label}>{t("health.scheduleVet.reason")}</Text>
        <View style={styles.reasonRow}>
          {REASONS.map((r) => (
            <Pressable
              key={r}
              style={[styles.reasonChip, reason === r && styles.reasonChipOn]}
              onPress={() => setReason(r)}
            >
              <Text style={[styles.reasonTx, reason === r && styles.reasonTxOn]}>
                {t(`vet.schedule.reasons.${r}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t("health.scheduleVet.notes")}</Text>
        <TextInput
          style={styles.input}
          multiline
          placeholder={t("health.scheduleVet.notesPlaceholder")}
          value={notes}
          onChangeText={setNotes}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[
            styles.submit,
            (!selectedSlot || !vet?.availability || scheduleMut.isPending) &&
              styles.submitDisabled
          ]}
          disabled={!selectedSlot || !vet?.availability || scheduleMut.isPending}
          onPress={() => {
            setError(null);
            scheduleMut.mutate();
          }}
        >
          {scheduleMut.isPending ? (
            <ActivityIndicator color={mobileColors.onAccent} />
          ) : (
            <Text style={styles.submitTx}>{t("health.scheduleVet.confirm")}</Text>
          )}
        </Pressable>
      </ScrollView>
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  farmLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  vetCard: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  vetName: {
    ...mobileTypography.title,
    fontSize: 18,
    color: mobileColors.textPrimary
  },
  vetMeta: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  warn: { color: mobileColors.warning, marginTop: 8, fontWeight: "600" },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  navBtn: { fontSize: 22, color: mobileColors.accent, padding: 8 },
  monthLabel: {
    ...mobileTypography.title,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  dayCell: {
    alignItems: "center",
    padding: 10,
    marginRight: 8,
    borderRadius: 12,
    minWidth: 48
  },
  dayCellActive: { backgroundColor: mobileColors.accent },
  dayName: { fontSize: 11, color: mobileColors.textSecondary },
  dayNameActive: { color: "rgba(255,255,255,0.9)" },
  dayNum: { fontSize: 16, fontWeight: "700", color: mobileColors.textPrimary },
  dayNumActive: { color: mobileColors.onAccent },
  label: {
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.sm
  },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  reasonChipOn: {
    backgroundColor: `${mobileColors.accent}18`,
    borderColor: mobileColors.accent
  },
  reasonTx: { fontSize: 13, color: mobileColors.textSecondary, fontWeight: "600" },
  reasonTxOn: { color: mobileColors.accent },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    minHeight: 80,
    color: mobileColors.textPrimary
  },
  submit: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: mobileSpacing.md
  },
  submitDisabled: { opacity: 0.5 },
  submitTx: { color: mobileColors.onAccent, fontWeight: "700", fontSize: 16 },
  error: { color: mobileColors.error }
});
