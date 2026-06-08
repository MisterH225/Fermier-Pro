import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AppDatePicker } from "../common/AppDatePicker";
import { BaseModal } from "../modals/BaseModal";
import { toIsoDateTimeString } from "../../lib/appDate";
import { ModalSection } from "../modals/ModalSection";
import { fetchCheptelPens, recordGestationLitter } from "../../lib/api";
import { mobileColors, mobileSpacing } from "../../theme/mobileTheme";
import {
  isOfflineQueuedResult,
  offlineQueuedMessage,
  useOfflineMutation
} from "../../hooks/useOfflineMutation";

type Props = {
  visible: boolean;
  farmId: string;
  gestationId: string;
  sowId: string;
  sowLabel: string;
  sowPenId?: string | null;
  accessToken: string;
  activeProfileId?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

type Step = "litter" | "pen";

export function MiseBasModal({
  visible,
  farmId,
  gestationId,
  sowId,
  sowLabel,
  sowPenId,
  accessToken,
  activeProfileId,
  onClose,
  onSaved
}: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("litter");
  const [actualBirthDate, setActualBirthDate] = useState(() =>
    toIsoDateTimeString(new Date())
  );
  const [bornAlive, setBornAlive] = useState("");
  const [stillborn, setStillborn] = useState("0");
  const [mummified, setMummified] = useState("0");
  const [avgWeight, setAvgWeight] = useState("");
  const [deliveryType, setDeliveryType] = useState<
    "normal" | "difficult" | "cesarean"
  >("normal");
  const [vetAssistance, setVetAssistance] = useState(false);
  const [notes, setNotes] = useState("");
  const [penId, setPenId] = useState<string | null>(null);
  const [transferSowWithLitter, setTransferSowWithLitter] = useState(true);

  const aliveCount = Number.parseInt(bornAlive, 10);
  const needsPenStep = Number.isFinite(aliveCount) && aliveCount > 0;

  const pensQ = useQuery({
    queryKey: ["cheptelPens", farmId, activeProfileId, "miseBas"],
    queryFn: () => fetchCheptelPens(accessToken, farmId, activeProfileId),
    enabled: visible && step === "pen"
  });

  const pens = pensQ.data?.pens ?? [];

  const defaultPenId = useMemo(() => {
    if (pens.length === 0) {
      return null;
    }
    const fits = (p: (typeof pens)[0]) => {
      const cap = p.capacity ?? 0;
      if (cap <= 0) {
        return true;
      }
      return cap - (p.occupancy ?? 0) >= aliveCount;
    };
    if (sowPenId) {
      const sowPen = pens.find((p) => p.id === sowPenId);
      if (sowPen && fits(sowPen)) {
        return sowPen.id;
      }
    }
    const empty = pens.find((p) => (p.occupancy ?? 0) === 0 && fits(p));
    if (empty) {
      return empty.id;
    }
    return pens.find(fits)?.id ?? pens[0]?.id ?? null;
  }, [pens, sowPenId, aliveCount]);

  useEffect(() => {
    if (!visible) {
      setStep("litter");
      setActualBirthDate(toIsoDateTimeString(new Date()));
      setBornAlive("");
      setStillborn("0");
      setMummified("0");
      setAvgWeight("");
      setDeliveryType("normal");
      setVetAssistance(false);
      setNotes("");
      setPenId(null);
      setTransferSowWithLitter(true);
      return;
    }
    if (step === "pen" && defaultPenId && !penId) {
      setPenId(defaultPenId);
    }
  }, [visible, step, defaultPenId, penId]);

  const selectedPen = pens.find((p) => p.id === penId);

  const capacityWarning = useMemo(() => {
    if (!selectedPen || !needsPenStep) {
      return null;
    }
    const cap = selectedPen.capacity ?? 0;
    if (cap <= 0) {
      return null;
    }
    const nextOcc = (selectedPen.occupancy ?? 0) + aliveCount;
    if (nextOcc > cap) {
      return "block" as const;
    }
    if (nextOcc / cap > 0.8) {
      return "warn" as const;
    }
    return null;
  }, [selectedPen, aliveCount, needsPenStep]);

  const buildBody = () => {
    const alive = Number.parseInt(bornAlive, 10);
    const dead = Number.parseInt(stillborn, 10) || 0;
    if (!Number.isFinite(alive) || alive < 0) {
      throw new Error(t("gestationScreen.invalidBornAlive"));
    }
    if (alive > 0 && step === "pen") {
      if (!penId) {
        throw new Error(t("gestationScreen.penRequired"));
      }
      if (capacityWarning === "block") {
        throw new Error(t("gestationScreen.penFull"));
      }
    }
    return {
      actualBirthDate,
      bornAlive: alive,
      stillborn: dead,
      mummified: Number.parseInt(mummified, 10) || 0,
      averageBirthWeightKg: avgWeight
        ? Number.parseFloat(avgWeight)
        : undefined,
      deliveryType,
      vetAssistance,
      notes: notes.trim() || undefined,
      ...(alive > 0 && penId
        ? {
            penId,
            transferSowWithLitter
          }
        : {})
    };
  };

  const mut = useOfflineMutation({
    farmId,
    type: "gestation.recordLitter",
    label: sowLabel,
    mutationFn: async () =>
      recordGestationLitter(
        accessToken,
        farmId,
        gestationId,
        buildBody(),
        activeProfileId
      ),
    buildOfflineItem: () => ({
      calls: [
        {
          method: "POST",
          path: `/farms/${farmId}/gestation/gestations/${gestationId}/litter`,
          body: buildBody()
        }
      ],
      invalidateRoots: [
        "gestation",
        "dashboardGestations",
        "farmAnimals",
        "farmCheptel",
        "cheptelPens",
        "penContents",
        "penDetail"
      ]
    }),
    onSuccess: (data) => {
      onSaved();
      onClose();
      if (isOfflineQueuedResult(data)) {
        Alert.alert("", offlineQueuedMessage(t));
        return;
      }
      const n =
        (data as { litter?: { bornAlive?: number } }).litter?.bornAlive ??
        bornAlive;
      Alert.alert(
        t("gestationScreen.litterSuccessTitle"),
        n && Number(n) > 0
          ? t("gestationScreen.litterSuccessWithPen", { count: n })
          : t("gestationScreen.litterSuccessBody", { count: n })
      );
    },
    onQueued: () => {
      onSaved();
      onClose();
      Alert.alert("", offlineQueuedMessage(t));
    },
    onError: (e: Error) =>
      Alert.alert(t("gestationScreen.error"), getUserFacingError(e, t))
  });

  const onPrimaryPress = () => {
    try {
      const alive = Number.parseInt(bornAlive, 10);
      if (!Number.isFinite(alive) || alive < 0) {
        throw new Error(t("gestationScreen.invalidBornAlive"));
      }
      if (step === "litter" && alive > 0) {
        setStep("pen");
        if (defaultPenId) {
          setPenId(defaultPenId);
        }
        return;
      }
      mut.mutate();
    } catch (e) {
      Alert.alert(
        t("gestationScreen.error"),
        getUserFacingError(e as Error, t)
      );
    }
  };

  const primaryLabel =
    step === "litter" && needsPenStep
      ? t("gestationScreen.continueToPen")
      : t("gestationScreen.save");

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={
        step === "pen"
          ? t("gestationScreen.penStepTitle")
          : t("gestationScreen.litterTitle")
      }
      statusBadge={{ label: sowLabel, tone: "neutral" }}
      footerPrimary={
        <View style={styles.footerRow}>
          {step === "pen" ? (
            <Pressable
              style={styles.btnSecondary}
              onPress={() => setStep("litter")}
              disabled={mut.isPending}
            >
              <Text style={styles.btnSecondaryText}>
                {t("gestationScreen.back")}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[
              styles.btn,
              mut.isPending && styles.btnDisabled,
              step === "pen" && styles.btnFlex
            ]}
            onPress={onPrimaryPress}
            disabled={mut.isPending}
          >
            {mut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{primaryLabel}</Text>
            )}
          </Pressable>
        </View>
      }
    >
      {step === "litter" ? (
        <ModalSection title={t("modals.sections.details")}>
          <AppDatePicker
            label={t("gestationScreen.birthDateTime")}
            mode="datetime"
            isoValue={actualBirthDate}
            onIsoChange={setActualBirthDate}
            farmId={farmId}
            maxDate={new Date()}
          />
          <Text style={styles.label}>{t("gestationScreen.bornAlive")}</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={bornAlive}
            onChangeText={setBornAlive}
          />
          <Text style={styles.label}>{t("gestationScreen.stillborn")}</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={stillborn}
            onChangeText={setStillborn}
          />
          <Text style={styles.label}>{t("gestationScreen.mummified")}</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={mummified}
            onChangeText={setMummified}
          />
          <Text style={styles.label}>{t("gestationScreen.avgWeight")}</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={avgWeight}
            onChangeText={setAvgWeight}
          />
          <Text style={styles.label}>{t("gestationScreen.deliveryType")}</Text>
          <View style={styles.row}>
            {(["normal", "difficult", "cesarean"] as const).map((k) => (
              <Pressable
                key={k}
                style={[styles.pill, deliveryType === k && styles.pillOn]}
                onPress={() => setDeliveryType(k)}
              >
                <Text style={styles.pillText}>
                  {t(`gestationScreen.deliveryTypes.${k}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={styles.toggle}
            onPress={() => setVetAssistance((v) => !v)}
          >
            <Text>
              {t("gestationScreen.vetAssistance")}: {vetAssistance ? "✓" : "—"}
            </Text>
          </Pressable>
          <Text style={styles.label}>{t("gestationScreen.notes")}</Text>
          <TextInput
            style={[styles.input, styles.notes]}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </ModalSection>
      ) : (
        <ModalSection title={t("gestationScreen.penStepTitle")}>
          <Text style={styles.hint}>
            {t("gestationScreen.penStepHint", { count: aliveCount })}
          </Text>
          {pensQ.isPending ? (
            <ActivityIndicator color={mobileColors.accent} />
          ) : pens.length === 0 ? (
            <Text style={styles.hint}>{t("gestationScreen.noPens")}</Text>
          ) : (
            <ScrollView style={styles.penList} nestedScrollEnabled>
              {pens.map((p) => {
                const cap = p.capacity ?? 0;
                const occ = p.occupancy ?? 0;
                const free = cap > 0 ? Math.max(0, cap - occ) : null;
                const isEmpty = occ === 0;
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.penCard, penId === p.id && styles.penCardOn]}
                    onPress={() => setPenId(p.id)}
                  >
                    <Text style={styles.penName}>{p.name}</Text>
                    <Text style={styles.penMeta}>
                      {p.barnName}
                      {free != null
                        ? ` · ${t("gestationScreen.penFree", { count: free })}`
                        : ""}
                      {isEmpty ? ` · ${t("gestationScreen.penEmpty")}` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          {capacityWarning === "warn" ? (
            <Text style={styles.warnText}>
              {t("gestationScreen.penCapacityWarn")}
            </Text>
          ) : null}
          {capacityWarning === "block" ? (
            <Text style={styles.blockText}>
              {t("gestationScreen.penFull")}
            </Text>
          ) : null}
          <Pressable
            style={styles.toggle}
            onPress={() => setTransferSowWithLitter((v) => !v)}
          >
            <Text>
              {transferSowWithLitter ? "☑" : "☐"}{" "}
              {t("gestationScreen.transferSowWithLitter")}
            </Text>
          </Pressable>
        </ModalSection>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: 10,
    padding: mobileSpacing.sm,
    backgroundColor: "#fff"
  },
  notes: { minHeight: 64 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: mobileColors.surfaceMuted
  },
  pillOn: { backgroundColor: mobileColors.accent },
  pillText: { fontSize: 12 },
  toggle: { paddingVertical: 8 },
  hint: { color: mobileColors.textSecondary, marginBottom: mobileSpacing.sm },
  penList: { maxHeight: 220 },
  penCard: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: 10,
    padding: mobileSpacing.sm,
    marginBottom: 8,
    backgroundColor: "#fff"
  },
  penCardOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.surfaceMuted
  },
  penName: { fontWeight: "600" },
  penMeta: { fontSize: 12, color: mobileColors.textSecondary, marginTop: 2 },
  warnText: { color: mobileColors.warning, marginTop: 8 },
  blockText: { color: mobileColors.error, marginTop: 8 },
  footerRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  btn: {
    backgroundColor: mobileColors.accent,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    flex: 1
  },
  btnFlex: { flex: 1 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "600" },
  btnSecondary: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: mobileColors.border,
    justifyContent: "center"
  },
  btnSecondaryText: { fontWeight: "600" }
});
