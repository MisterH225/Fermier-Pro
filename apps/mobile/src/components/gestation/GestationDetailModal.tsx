import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { GestationProgressBar } from "./GestationProgressBar";
import {
  administerGestationVaccine,
  fetchGestationDetail,
  patchGestationStatus,
  toggleGestationChecklistItem
} from "../../lib/api";
import { mobileColors, mobileSpacing } from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  gestationId: string | null;
  accessToken: string;
  activeProfileId?: string | null;
  farmId: string;
  onClose: () => void;
  onRefresh: () => void;
  onRecordLitter: (gestationId: string, sowLabel: string) => void;
  onOpenAnimal: (animalId: string, label: string) => void;
};

function urgencyBadge(
  u: string | null | undefined,
  t: (k: string) => string
): { label: string; tone: "warning" | "neutral" } | undefined {
  if (u === "critical") {
    return { label: t("gestationScreen.urgencyCritical"), tone: "warning" };
  }
  if (u === "soon") {
    return { label: t("gestationScreen.urgencySoon"), tone: "warning" };
  }
  return { label: t("gestationScreen.urgencyActive"), tone: "neutral" };
}

export function GestationDetailModal({
  visible,
  gestationId,
  accessToken,
  activeProfileId,
  farmId,
  onClose,
  onRefresh,
  onRecordLitter,
  onOpenAnimal
}: Props) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["gestation", gestationId, activeProfileId],
    queryFn: () =>
      fetchGestationDetail(accessToken, farmId, gestationId!, activeProfileId),
    enabled: visible && Boolean(gestationId)
  });

  const vaccMut = useMutation({
    mutationFn: (vaccineId: string) =>
      administerGestationVaccine(accessToken, farmId, vaccineId, activeProfileId),
    onSuccess: () => {
      q.refetch();
      onRefresh();
    }
  });

  const checkMut = useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) =>
      toggleGestationChecklistItem(
        accessToken,
        farmId,
        id,
        checked,
        activeProfileId
      ),
    onSuccess: () => q.refetch()
  });

  const closeMut = useMutation({
    mutationFn: (status: "aborted" | "lost") =>
      patchGestationStatus(
        accessToken,
        farmId,
        gestationId!,
        status,
        activeProfileId
      ),
    onSuccess: () => {
      onRefresh();
      onClose();
    }
  });

  const g = q.data;
  const prog = g?.progress;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={g?.sowLabel ?? t("gestationScreen.detailTitle")}
      statusBadge={urgencyBadge(prog?.urgency ?? null, t)}
      secondaryActions={
        g
          ? [
              {
                key: "animal",
                icon: "paw-outline",
                label: t("gestationScreen.openAnimal"),
                onPress: () =>
                  onOpenAnimal(g.sowId, g.sowLabel)
              }
            ]
          : undefined
      }
      footerPrimary={
        g?.status === "active" ? (
          <Pressable
            style={styles.btn}
            onPress={() => onRecordLitter(g.id, g.sowLabel)}
          >
            <Text style={styles.btnText}>
              {t("gestationScreen.recordLitter")}
            </Text>
          </Pressable>
        ) : undefined
      }
      destructiveAction={
        g?.status === "active"
          ? {
              label: t("gestationScreen.closeGestation"),
              onPress: () =>
                Alert.alert(t("gestationScreen.closeGestation"), "", [
                  {
                    text: t("gestationScreen.abort"),
                    style: "destructive",
                    onPress: () => closeMut.mutate("aborted")
                  },
                  {
                    text: t("gestationScreen.lost"),
                    style: "destructive",
                    onPress: () => closeMut.mutate("lost")
                  },
                  { text: t("gestationScreen.cancel"), style: "cancel" }
                ])
            }
          : undefined
      }
    >
      {q.isPending ? (
        <ActivityIndicator style={{ marginVertical: 24 }} />
      ) : g ? (
        <View style={styles.body}>
          <Text style={styles.meta}>
            {t("gestationScreen.matingDate")}:{" "}
            {g.matingDate.slice(0, 10)} · #{g.gestationNumber}
          </Text>
          <Text style={styles.meta}>
            {t("gestationScreen.expectedBirth")}:{" "}
            {g.expectedBirthDate.slice(0, 10)}
          </Text>
          {prog ? (
            <GestationProgressBar
              progressPct={prog.progressPct}
              weekLabel={`S${prog.weekCurrent} / ${prog.weekTotal}`}
            />
          ) : null}

          <Text style={styles.section}>{t("gestationScreen.vaccines")}</Text>
          {g.vaccines?.map((v) => (
            <View key={v.id} style={styles.vaccineRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vaccineName}>{v.vaccineName}</Text>
                <Text style={styles.vaccineDate}>
                  {v.scheduledDate.slice(0, 10)} · {v.status}
                </Text>
              </View>
              {v.status !== "done" ? (
                <Pressable
                  onPress={() => vaccMut.mutate(v.id)}
                  style={styles.smallBtn}
                >
                  <Text style={styles.smallBtnText}>
                    {t("gestationScreen.markDone")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}

          {(prog?.daysRemaining ?? 99) <= 7 && g.checklistItems?.length ? (
            <>
              <Text style={styles.section}>
                {t("gestationScreen.preBirthChecklist")}
              </Text>
              {g.checklistItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.checkRow}
                  onPress={() =>
                    checkMut.mutate({
                      id: item.id,
                      checked: !item.isChecked
                    })
                  }
                >
                  <Text>{item.isChecked ? "☑" : "☐"}</Text>
                  <Text style={styles.checkLabel}>{item.itemLabel}</Text>
                </Pressable>
              ))}
            </>
          ) : null}
        </View>
      ) : (
        <Text style={styles.meta}>{t("gestationScreen.error")}</Text>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: mobileSpacing.md, paddingBottom: mobileSpacing.lg },
  meta: { color: mobileColors.textSecondary, fontSize: 13 },
  section: { fontWeight: "700", marginTop: 8, fontSize: 15 },
  vaccineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6
  },
  vaccineName: { fontWeight: "600" },
  vaccineDate: { fontSize: 12, color: mobileColors.textSecondary },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: mobileColors.accent,
    borderRadius: 8
  },
  smallBtnText: { color: "#fff", fontSize: 12 },
  checkRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  checkLabel: { flex: 1, fontSize: 14 },
  btn: {
    backgroundColor: mobileColors.accent,
    padding: 14,
    borderRadius: 12,
    alignItems: "center"
  },
  btnText: { color: "#fff", fontWeight: "600" }
});
