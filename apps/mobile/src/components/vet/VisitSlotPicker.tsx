import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  slotsForPeriod,
  toDateIso,
  type VisitPeriod
} from "../../lib/visitSlots";
import { fetchVetAvailability } from "../../lib/api";
import { vetColors, vetRadius } from "../../theme/vetTheme";
import { mobileSpacing } from "../../theme/mobileTheme";

type VisitSlotPickerProps = {
  vetProfileId: string;
  selectedDay: Date;
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
  accessToken: string;
  activeProfileId?: string | null;
  accent?: "vet" | "producer";
};

export function VisitSlotPicker({
  vetProfileId,
  selectedDay,
  selectedSlot,
  onSelectSlot,
  accessToken,
  activeProfileId,
  accent = "vet"
}: VisitSlotPickerProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<VisitPeriod>("morning");
  const dateIso = toDateIso(selectedDay);
  const colors =
    accent === "producer"
      ? {
          primary: "#1B3B2E",
          primaryLight: "#E8F5E9",
          border: "rgba(27, 59, 46, 0.12)"
        }
      : {
          primary: vetColors.primary,
          primaryLight: vetColors.primaryLight,
          border: vetColors.border
        };

  const availQ = useQuery({
    queryKey: ["vetAvailability", vetProfileId, dateIso, activeProfileId],
    queryFn: () =>
      fetchVetAvailability(accessToken, vetProfileId, dateIso, activeProfileId),
    enabled: Boolean(accessToken && vetProfileId)
  });

  const slotMap = useMemo(() => {
    const m = new Map<string, "available" | "occupied" | "unavailable">();
    for (const s of availQ.data?.slots ?? []) {
      m.set(s.time, s.status);
    }
    return m;
  }, [availQ.data?.slots]);

  const periodSlots = slotsForPeriod(period);

  if (availQ.isPending) {
    return <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />;
  }

  if (availQ.data && !availQ.data.vetAvailable) {
    return (
      <Text style={[styles.warn, { color: vetColors.warning }]}>
        {t("health.scheduleVet.vetUnavailable")}
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{t("vet.agenda.chooseSlot")}</Text>
      <View style={styles.periodRow}>
        {(["morning", "afternoon", "evening"] as VisitPeriod[]).map((p) => (
          <Pressable
            key={p}
            style={[
              styles.periodPill,
              { borderColor: colors.border },
              period === p && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => setPeriod(p)}
          >
            <Text
              style={[
                styles.periodTx,
                period === p && styles.periodTxOn
              ]}
            >
              {t(`vet.agenda.period.${p}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.slots}>
        {periodSlots.map((slot) => {
          const status = slotMap.get(slot) ?? "available";
          const occupied = status === "occupied" || status === "unavailable";
          const selected = selectedSlot === slot;
          return (
            <Pressable
              key={slot}
              disabled={occupied}
              style={[
                styles.slot,
                { borderColor: colors.border },
                occupied && styles.slotOccupied,
                selected && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={() => onSelectSlot(slot)}
            >
              <Text
                style={[
                  styles.slotTx,
                  (occupied || selected) && styles.slotTxInv
                ]}
              >
                {slot}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: vetColors.textPrimary },
  warn: { fontSize: 14, marginVertical: 8 },
  periodRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  periodPill: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: 10,
    borderRadius: vetRadius.button,
    backgroundColor: vetColors.cardBg,
    borderWidth: 1,
    alignItems: "center"
  },
  periodTx: { fontWeight: "600", color: vetColors.textSecondary, fontSize: 13 },
  periodTxOn: { color: "#fff" },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: {
    width: "30%",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: vetColors.cardBg,
    alignItems: "center",
    borderWidth: 1
  },
  slotOccupied: { backgroundColor: "#6B7280", borderColor: "#6B7280" },
  slotTx: { fontWeight: "600", color: vetColors.textPrimary },
  slotTxInv: { color: "#fff" }
});
