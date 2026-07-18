import {
  findEmptyPenForLitter,
  litterPenCapacityWarning,
  rankPensForLitterSuggestion
} from "@fermier/types";
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
import { recordGestationLitter } from "../../lib/api";
import { useCheptelPens } from "../../lib/cheptelPensQuery";
import { mobileColors, mobileSpacing } from "../../theme/mobileTheme";
import {
  isOfflineQueuedResult,
  offlineQueuedMessage,
  useOfflineMutation
} from "../../hooks/useOfflineMutation";
import { usePostSaveInsight } from "../../hooks/usePostSaveInsight";

type Props = {
  visible: boolean;
  farmId: string;
  gestationId: string;
  sowLabel: string;
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
  sowLabel,
  accessToken,
  activeProfileId,
  onClose,
  onSaved
}: Props) {
  const { t } = useTranslation();
  const insights = usePostSaveInsight();
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

  const aliveCount = Number.parseInt(bornAlive, 10);
  const needsPenChoice = Number.isFinite(aliveCount) && aliveCount > 0;

  const pensQ = useCheptelPens({
    farmId,
    accessToken,
    activeProfileId,
    enabled: visible && needsPenChoice
  });

  const pens = pensQ.data?.pens ?? [];

  const emptyAutoPenId = useMemo(() => {
    if (!needsPenChoice || pens.length === 0) {
      return null;
    }
    return findEmptyPenForLitter(pens, aliveCount);
  }, [pens, aliveCount, needsPenChoice]);

  const rankedPens = useMemo(() => {
    if (!needsPenChoice || pens.length === 0) {
      return [];
    }
    const ranked = rankPensForLitterSuggestion(pens, aliveCount);
    const byId = new Map(pens.map((pen) => [pen.id, pen]));
    return ranked
      .map((row) => {
        const pen = byId.get(row.id);
        return pen ? { pen, suggested: row.suggested } : null;
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
  }, [pens, aliveCount, needsPenChoice]);

  const suggestedPenId = rankedPens.find((row) => row.suggested)?.pen.id ?? null;

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
      return;
    }
    if (step === "pen" && suggestedPenId && !penId) {
      setPenId(suggestedPenId);
    }
  }, [visible, step, suggestedPenId, penId]);

  const selectedPen = pens.find((p) => p.id === penId);

  const capacityWarning = useMemo(() => {
    if (!selectedPen || !needsPenChoice) {
      return null;
    }
    return litterPenCapacityWarning(
      selectedPen.occupancy ?? 0,
      selectedPen.capacity,
      aliveCount
    );
  }, [selectedPen, aliveCount, needsPenChoice]);

  const buildBody = (resolvedPenId?: string) => {
    const alive = Number.parseInt(bornAlive, 10);
    const dead = Number.parseInt(stillborn, 10) || 0;
    if (!Number.isFinite(alive) || alive < 0) {
      throw new Error(t("gestationScreen.invalidBornAlive"));
    }
    const placementPenId =
      resolvedPenId ?? (step === "pen" ? penId : emptyAutoPenId);
    if (alive > 0) {
      if (!placementPenId) {
        throw new Error(t("gestationScreen.penRequired"));
      }
      if (step === "pen" && capacityWarning === "block") {
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
      ...(alive > 0 && placementPenId ? { penId: placementPenId } : {})
    };
  };

  const mut = useOfflineMutation<string | undefined>({
    farmId,
    type: "gestation.recordLitter",
    label: sowLabel,
    mutationFn: async (resolvedPenId) =>
      recordGestationLitter(
        accessToken,
        farmId,
        gestationId,
        buildBody(resolvedPenId),
        activeProfileId
      ),
    buildOfflineItem: (resolvedPenId) => ({
      calls: [
        {
          method: "POST",
          path: `/farms/${farmId}/gestation/gestations/${gestationId}/litter`,
          body: buildBody(resolvedPenId)
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
      const litterId =
        (data as { litterId?: string; litter?: { id?: string } }).litterId ??
        (data as { litter?: { id?: string } }).litter?.id;
      const body =
        n && Number(n) > 0
          ? t("gestationScreen.litterSuccessWithPen", { count: n })
          : t("gestationScreen.litterSuccessBody", { count: n });
      void (async () => {
        const insight =
          litterId != null
            ? await insights.afterFarrowing(
                { accessToken, farmId, activeProfileId },
                litterId
              )
            : undefined;
        Alert.alert(
          t("gestationScreen.litterSuccessTitle"),
          insight ? `${body}\n\n${insight}` : body
        );
      })();
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
        if (pensQ.isPending) {
          return;
        }
        if (emptyAutoPenId) {
          mut.mutate(emptyAutoPenId);
          return;
        }
        setStep("pen");
        if (suggestedPenId) {
          setPenId(suggestedPenId);
        }
        return;
      }
      mut.mutate(
        step === "pen" ? penId ?? undefined : emptyAutoPenId ?? undefined
      );
    } catch (e) {
      Alert.alert(
        t("gestationScreen.error"),
        getUserFacingError(e as Error, t)
      );
    }
  };

  const primaryLabel =
    step === "litter" && needsPenChoice && !emptyAutoPenId
      ? t("gestationScreen.continueToPen")
      : t("gestationScreen.save");

  const primaryDisabled =
    mut.isPending || (step === "litter" && needsPenChoice && pensQ.isPending);

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
              primaryDisabled && styles.btnDisabled,
              step === "pen" && styles.btnFlex
            ]}
            onPress={onPrimaryPress}
            disabled={primaryDisabled}
          >
            {primaryDisabled ? (
              <ActivityIndicator color={mobileColors.onAccent} />
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
          {needsPenChoice && emptyAutoPenId ? (
            <Text style={styles.autoHint}>
              {t("gestationScreen.autoEmptyPenHint")}
            </Text>
          ) : null}
        </ModalSection>
      ) : (
        <ModalSection title={t("gestationScreen.penStepTitle")}>
          <Text style={styles.hint}>
            {t("gestationScreen.penStepNoEmptyHint", { count: aliveCount })}
          </Text>
          {pensQ.isPending ? (
            <ActivityIndicator color={mobileColors.accent} />
          ) : rankedPens.length === 0 ? (
            <Text style={styles.hint}>{t("gestationScreen.noPens")}</Text>
          ) : (
            <ScrollView style={styles.penList} nestedScrollEnabled>
              {rankedPens.map(({ pen, suggested }) => {
                const cap = pen.capacity ?? 0;
                const occ = pen.occupancy ?? 0;
                const free = cap > 0 ? Math.max(0, cap - occ) : null;
                const isEmpty = occ === 0;
                return (
                  <Pressable
                    key={pen.id}
                    style={[
                      styles.penCard,
                      penId === pen.id && styles.penCardOn
                    ]}
                    onPress={() => setPenId(pen.id)}
                  >
                    <Text style={styles.penName}>
                      {pen.name}
                      {suggested
                        ? ` · ${t("gestationScreen.penSuggested")}`
                        : ""}
                    </Text>
                    <Text style={styles.penMeta}>
                      {pen.barnName}
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
          <Text style={styles.hint}>
            {t("gestationScreen.sowMovesWithLitter")}
          </Text>
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
    backgroundColor: mobileColors.background
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
  autoHint: {
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm,
    fontSize: 13
  },
  penList: { maxHeight: 220 },
  penCard: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: 10,
    padding: mobileSpacing.sm,
    marginBottom: 8,
    backgroundColor: mobileColors.background
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
  btnText: { color: mobileColors.onAccent, fontWeight: "600" },
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
