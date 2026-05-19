import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BaseModal } from "../../modals/BaseModal";
import type { AnimalListItem } from "../../../lib/api";
import { fetchFarmAnimal } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import {
  animalDisplayTag,
  formatAnimalKg,
  sexIconColor,
  sexIconName
} from "./animalUtils";

type Props = {
  visible: boolean;
  animal: AnimalListItem | null;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  onClose: () => void;
  onEdit: (animal: AnimalListItem) => void;
  onTransfer: (animal: AnimalListItem) => void;
  onChangeStatus: (animal: AnimalListItem) => void;
  onAddWeight: (animal: AnimalListItem) => void;
  onOpenHealth?: (animal: AnimalListItem) => void;
};

export function AnimalDetailModal({
  visible,
  animal,
  farmId,
  accessToken,
  activeProfileId,
  onClose,
  onEdit,
  onTransfer,
  onChangeStatus,
  onAddWeight,
  onOpenHealth
}: Props) {
  const { t } = useTranslation();

  const detailQuery = useQuery({
    queryKey: ["farmAnimal", farmId, animal?.id, activeProfileId],
    queryFn: () =>
      fetchFarmAnimal(accessToken, farmId, animal!.id, activeProfileId),
    enabled: visible && Boolean(animal?.id)
  });

  if (!animal) {
    return null;
  }

  const tag = animalDisplayTag(animal);
  const detail = detailQuery.data;
  const latest = detail?.weights[0] ?? animal.weights[0];
  const entry = detail?.weights[detail.weights.length - 1];

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={tag}
      statusBadge={{
        label: t(`cheptel.animals.status.${animal.status}`),
        tone: animal.status === "active" ? "neutral" : "warning"
      }}
    >
      {detailQuery.isPending ? (
        <ActivityIndicator color={mobileColors.accent} style={{ marginVertical: 24 }} />
      ) : (
        <View style={styles.body}>
          <View style={styles.photoRow}>
            <View style={styles.photoCircle}>
              <Ionicons
                name={sexIconName(animal.sex)}
                size={36}
                color={sexIconColor(animal.sex)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t("cheptel.animals.detail.breed")}</Text>
              <Text style={styles.rowValue}>
                {animal.breed?.name ?? detail?.breed?.name ?? "—"}
              </Text>
              <Text style={[styles.rowLabel, { marginTop: 8 }]}>
                {t("cheptel.animals.detail.pen")}
              </Text>
              <Text style={styles.rowValue}>
                {animal.currentPen
                  ? `${animal.currentPen.barnName} · ${animal.currentPen.penName}`
                  : t("cheptel.animals.noPen")}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("cheptel.animals.detail.weight")}</Text>
            <Text style={styles.meta}>
              {t("cheptel.animals.detail.entryWeight")}: {formatAnimalKg(entry?.weightKg)}
            </Text>
            <Text style={styles.meta}>
              {t("cheptel.animals.detail.currentWeight")}: {formatAnimalKg(latest?.weightKg)}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("cheptel.animals.detail.health")}</Text>
            <Text style={styles.meta}>{t("cheptel.animals.detail.healthSoon")}</Text>
            {onOpenHealth ? (
              <Pressable style={styles.linkBtn} onPress={() => onOpenHealth(animal)}>
                <Text style={styles.linkBtnText}>
                  {t("cheptel.animals.detail.openHealth")}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.actions}>
            <ActionChip
              icon="create-outline"
              label={t("cheptel.animals.detail.edit")}
              onPress={() => onEdit(animal)}
            />
            <ActionChip
              icon="swap-horizontal"
              label={t("cheptel.animals.detail.transfer")}
              onPress={() => onTransfer(animal)}
            />
            <ActionChip
              icon="scale-outline"
              label={t("cheptel.animals.detail.addWeight")}
              onPress={() => onAddWeight(animal)}
            />
            <ActionChip
              icon="refresh"
              label={t("cheptel.animals.detail.changeStatus")}
              onPress={() => onChangeStatus(animal)}
            />
          </View>
        </View>
      )}
    </BaseModal>
  );
}

function ActionChip({
  icon,
  label,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionChip} onPress={onPress}>
      <Ionicons name={icon} size={18} color={mobileColors.accent} />
      <Text style={styles.actionChipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { gap: mobileSpacing.md, paddingBottom: mobileSpacing.lg },
  photoRow: { flexDirection: "row", gap: mobileSpacing.md, alignItems: "center" },
  photoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: mobileColors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  rowLabel: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  rowValue: { ...mobileTypography.body, fontWeight: "600" },
  section: { gap: 4 },
  sectionTitle: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginBottom: 4
  },
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  linkBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accentSoft
  },
  linkBtnText: { color: mobileColors.accent, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: mobileSpacing.sm },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  actionChipText: { ...mobileTypography.meta, fontWeight: "600", color: mobileColors.accent }
});
