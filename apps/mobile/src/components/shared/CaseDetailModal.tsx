import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import type { AnimalListItem, FarmHealthRecordRowDto } from "../../lib/api";
import {
  declareDiseaseDeath,
  resolveFarmDiseaseCase,
  updateFarmDiseaseCase
} from "../../lib/api";
import { formatAuthError } from "../../lib/authErrors";
import { formatHealthDay } from "../sante/healthUtils";
import { animalDisplayTag } from "../cheptel/animals/animalUtils";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  record: FarmHealthRecordRowDto | null;
  allRecords?: FarmHealthRecordRowDto[];
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  animals: AnimalListItem[];
  locale: string;
  onClose: () => void;
  onResolved: () => void;
  onAddTreatment: (record: FarmHealthRecordRowDto) => void;
  onEdit: (record: FarmHealthRecordRowDto) => void;
  onNavigateCheptel?: (animalId: string) => void;
};

type TimelineEntry = {
  id: string;
  label: string;
  detail?: string;
  date: string;
};

function symptomTags(record: FarmHealthRecordRowDto): string[] {
  const raw = record.disease?.symptoms as { tags?: string[] } | null | undefined;
  return Array.isArray(raw?.tags) ? raw.tags : [];
}

function severityLabel(
  t: (k: string) => string,
  severity?: string | null
): string {
  if (severity === "severe") {
    return t("health.diseaseModal.severitySevere");
  }
  if (severity === "moderate") {
    return t("health.diseaseModal.severityModerate");
  }
  if (severity === "mild") {
    return t("health.diseaseModal.severityMild");
  }
  return "—";
}

function severityColor(severity?: string | null): string {
  if (severity === "severe") {
    return "#DC2626";
  }
  if (severity === "moderate") {
    return "#F97316";
  }
  if (severity === "mild") {
    return "#22C55E";
  }
  return mobileColors.textSecondary;
}

export function CaseDetailModal({
  visible,
  record,
  allRecords = [],
  farmId,
  accessToken,
  activeProfileId,
  animals,
  locale,
  onClose,
  onResolved,
  onAddTreatment,
  onEdit,
  onNavigateCheptel
}: Props) {
  const { t } = useTranslation();

  const resolveMut = useMutation({
    mutationFn: () => {
      if (!record) {
        throw new Error("missing");
      }
      return resolveFarmDiseaseCase(
        accessToken,
        farmId,
        record.id,
        activeProfileId
      );
    },
    onSuccess: () => {
      onResolved();
      onClose();
    },
    onError: (e: unknown) => {
      Alert.alert(t("health.errorTitle"), formatAuthError(e));
    }
  });

  const isolationMut = useMutation({
    mutationFn: (next: boolean) => {
      if (!record) {
        throw new Error("missing");
      }
      return updateFarmDiseaseCase(
        accessToken,
        farmId,
        record.id,
        { inIsolation: next },
        activeProfileId
      );
    },
    onSuccess: () => onResolved(),
    onError: (e: unknown) => {
      Alert.alert(t("health.errorTitle"), formatAuthError(e));
    }
  });

  const deathMut = useMutation({
    mutationFn: () => {
      if (!record) {
        throw new Error("missing");
      }
      return declareDiseaseDeath(
        accessToken,
        farmId,
        record.id,
        activeProfileId
      );
    },
    onSuccess: () => {
      onResolved();
      onClose();
    },
    onError: (e: unknown) => {
      Alert.alert(t("health.errorTitle"), formatAuthError(e));
    }
  });

  const timeline = useMemo((): TimelineEntry[] => {
    if (!record?.disease) {
      return [];
    }
    const entries: TimelineEntry[] = [
      {
        id: "declared",
        label: t("health.caseDetail.timelineDeclared"),
        date: formatHealthDay(record.occurredAt, locale),
        detail: record.disease.diagnosis ?? undefined
      }
    ];

    if (record.disease.inIsolation) {
      entries.push({
        id: "isolation",
        label: t("health.caseDetail.timelineIsolation"),
        date: formatHealthDay(record.occurredAt, locale)
      });
    }

    const linkedId = record.disease.linkedTreatmentRecordId;
    if (linkedId) {
      const linked = allRecords.find((r) => r.id === linkedId);
      entries.push({
        id: "treatment",
        label: t("health.caseDetail.timelineTreatment"),
        date: formatHealthDay(linked?.occurredAt ?? record.occurredAt, locale),
        detail: linked?.treatment?.drugName ?? undefined
      });
    } else     if (record.disease.treatmentOngoing) {
      entries.push({
        id: "treatment-flag",
        label: t("health.caseDetail.timelineTreatment"),
        date: formatHealthDay(record.occurredAt, locale)
      });
    }

    const entityTreatments = allRecords
      .filter(
        (r) =>
          r.kind === "treatment" &&
          r.entityType === record.entityType &&
          r.entityId === record.entityId &&
          new Date(r.occurredAt).getTime() >= new Date(record.occurredAt).getTime()
      )
      .sort(
        (a, b) =>
          new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
      );

    for (const tr of entityTreatments) {
      if (tr.id === record.disease.linkedTreatmentRecordId) {
        continue;
      }
      entries.push({
        id: `treatment-${tr.id}`,
        label: t("health.caseDetail.timelineTreatment"),
        date: formatHealthDay(tr.occurredAt, locale),
        detail: tr.treatment?.drugName ?? undefined
      });
    }

    if (record.disease.resolvedAt) {
      entries.push({
        id: "resolved",
        label:
          record.disease.caseStatus === "dead"
            ? t("health.caseDetail.timelineDeath")
            : t("health.caseDetail.timelineRecovered"),
        date: formatHealthDay(record.disease.resolvedAt, locale)
      });
    }

    return entries;
  }, [record, allRecords, locale, t]);

  const confirmDeath = () => {
    Alert.alert(
      t("health.caseDetail.declareDeathTitle"),
      t("health.caseDetail.declareDeathMessage"),
      [
        { text: t("health.cancel"), style: "cancel" },
        {
          text: t("health.caseDetail.declareDeathConfirm"),
          style: "destructive",
          onPress: () => deathMut.mutate()
        }
      ]
    );
  };

  if (!record?.disease) {
    return null;
  }

  const animal = animals.find((a) => a.id === record.entityId);
  const tags = symptomTags(record);
  const sev = record.disease.severity;
  const isActive = record.disease.caseStatus === "active";

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("health.caseDetail.title")}
      footerPrimary={
        isActive ? (
          <Pressable
            style={[styles.primaryBtn, resolveMut.isPending && styles.btnDisabled]}
            disabled={resolveMut.isPending}
            onPress={() => resolveMut.mutate()}
          >
            {resolveMut.isPending ? (
              <ActivityIndicator color={mobileColors.onAccent} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {t("health.caseDetail.markRecovered")}
              </Text>
            )}
          </Pressable>
        ) : undefined
      }
    >
      <ModalSection title={t("health.caseDetail.subject")}>
        {animal ? (
          <Pressable
            disabled={!onNavigateCheptel}
            onPress={() => onNavigateCheptel?.(animal.id)}
          >
            <Text style={styles.link}>
              {animalDisplayTag(animal)} · {animal.currentPen?.penName ?? "—"}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.body}>{record.entityId.slice(0, 8)}</Text>
        )}
      </ModalSection>

      <ModalSection title={t("health.caseDetail.symptoms")}>
        <View style={styles.tagRow}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </ModalSection>

      <ModalSection title={t("health.caseDetail.details")}>
        <Text style={styles.meta}>
          {t("health.diseaseModal.severity")}:{" "}
          <Text style={{ color: severityColor(sev), fontWeight: "700" }}>
            {severityLabel(t, sev)}
          </Text>
        </Text>
        <Text style={styles.meta}>
          {t("health.diseaseModal.duration")}:{" "}
          {record.disease.durationEstimate ?? "—"}
        </Text>
        <Text style={styles.meta}>
          {t("health.caseDetail.declared")}: {formatHealthDay(record.occurredAt, locale)}
        </Text>
        {record.notes ? <Text style={styles.body}>{record.notes}</Text> : null}
      </ModalSection>

      {timeline.length > 0 ? (
        <ModalSection title={t("health.caseDetail.timeline")}>
          {timeline.map((entry, idx) => (
            <View key={entry.id} style={styles.timelineRow}>
              <View style={styles.timelineDotCol}>
                <View style={styles.timelineDot} />
                {idx < timeline.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>{entry.label}</Text>
                <Text style={styles.meta}>{entry.date}</Text>
                {entry.detail ? <Text style={styles.body}>{entry.detail}</Text> : null}
              </View>
            </View>
          ))}
        </ModalSection>
      ) : null}

      {isActive ? (
        <ModalSection title={t("health.caseDetail.actions")}>
          <View style={styles.actionRow}>
            <Pressable
              style={styles.actionBtn}
              onPress={() => onAddTreatment(record)}
            >
              <Text style={styles.actionBtnText}>
                {t("health.caseDetail.addTreatment")}
              </Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => onEdit(record)}>
              <Text style={styles.actionBtnText}>{t("health.caseDetail.edit")}</Text>
            </Pressable>
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("health.diseaseModal.isolationToggle")}</Text>
            <Switch
              value={record.disease.inIsolation === true}
              disabled={isolationMut.isPending}
              onValueChange={(v) => isolationMut.mutate(v)}
            />
          </View>
          {record.entityType === "animal" ? (
            <Pressable
              style={[styles.deathBtn, deathMut.isPending && styles.btnDisabled]}
              disabled={deathMut.isPending}
              onPress={confirmDeath}
            >
              {deathMut.isPending ? (
                <ActivityIndicator color={mobileColors.error} />
              ) : (
                <Text style={styles.deathBtnText}>
                  {t("health.caseDetail.declareDeath")}
                </Text>
              )}
            </Pressable>
          ) : null}
        </ModalSection>
      ) : null}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  link: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.accent
  },
  body: { ...mobileTypography.body, color: mobileColors.textPrimary },
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.accentSoft
  },
  tagText: { ...mobileTypography.meta, fontWeight: "600" },
  timelineRow: { flexDirection: "row", gap: mobileSpacing.sm },
  timelineDotCol: { alignItems: "center", width: 16 },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: mobileColors.accent,
    marginTop: 4
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: mobileColors.border,
    marginVertical: 4
  },
  timelineContent: { flex: 1, paddingBottom: mobileSpacing.md },
  timelineLabel: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  actionRow: { flexDirection: "row", gap: mobileSpacing.sm, marginBottom: mobileSpacing.sm },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 10,
    alignItems: "center"
  },
  actionBtnText: { color: mobileColors.accent, fontWeight: "700" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: mobileSpacing.sm
  },
  switchLabel: { ...mobileTypography.body, flex: 1, paddingRight: mobileSpacing.sm },
  deathBtn: {
    borderWidth: 1,
    borderColor: mobileColors.error,
    borderRadius: mobileRadius.pill,
    paddingVertical: 12,
    alignItems: "center"
  },
  deathBtnText: { color: mobileColors.error, fontWeight: "700" },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: mobileColors.onAccent, fontWeight: "700", fontSize: 16 }
});
