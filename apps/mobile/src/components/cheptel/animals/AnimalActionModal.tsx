import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BaseModal } from "../../modals/BaseModal";
import type { PenAnimalRowDto } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

type Action = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  animal: PenAnimalRowDto | null;
  onClose: () => void;
  onTransfer: () => void;
  onChangeStatus: () => void;
  onAddWeight: () => void;
  onOpenHealth: () => void;
  onOpenDetail: () => void;
  onDeclareGestation?: () => void;
  onListForSale?: () => void;
};

export function AnimalActionModal({
  visible,
  animal,
  onClose,
  onTransfer,
  onChangeStatus,
  onAddWeight,
  onOpenHealth,
  onOpenDetail,
  onDeclareGestation,
  onListForSale
}: Props) {
  const { t } = useTranslation();
  if (!animal) {
    return null;
  }

  const tag = animal.tagCode?.trim() || `FP-${animal.publicId.slice(-6)}`;
  const weight =
    animal.currentWeightKg != null
      ? `${animal.currentWeightKg} kg`
      : "—";

  const actions: Action[] = [
    {
      key: "transfer",
      label: t("cheptel.actions.transfer"),
      icon: "swap-horizontal-outline",
      onPress: onTransfer
    },
    {
      key: "status",
      label: t("cheptel.actions.changeStatus"),
      icon: "refresh-outline",
      onPress: onChangeStatus
    },
    {
      key: "vaccine",
      label: t("cheptel.actions.addVaccine"),
      icon: "medical-outline",
      onPress: onOpenHealth
    },
    {
      key: "weight",
      label: t("cheptel.actions.weigh"),
      icon: "scale-outline",
      onPress: onAddWeight
    },
    {
      key: "sale",
      label: t("cheptel.actions.listForSale"),
      icon: "pricetag-outline",
      onPress: onListForSale ?? onOpenDetail
    },
    {
      key: "detail",
      label: t("cheptel.actions.fullRecord"),
      icon: "document-text-outline",
      onPress: onOpenDetail
    }
  ];

  const isBreedingFemale =
    animal.sex === "female" &&
    (animal.productionCategory === "breeding_female" ||
      /^Trui-/i.test(animal.tagCode ?? ""));

  if (isBreedingFemale && onDeclareGestation) {
    actions.push({
      key: "gestation",
      label: t("cheptel.actions.declareGestation"),
      icon: "heart-outline",
      onPress: onDeclareGestation
    });
  }

  return (
    <BaseModal visible={visible} onClose={onClose} title={tag}>
      <View style={styles.headerMeta}>
        <Text style={styles.meta}>
          {animal.breed?.name ?? "—"} ·{" "}
          {animal.sex === "unknown"
            ? t("cheptel.unknownSex")
            : animal.sex === "male"
              ? t("cheptel.animals.sexMale")
              : t("cheptel.animals.sexFemale")}
        </Text>
        <Text style={styles.meta}>{t("cheptel.actions.currentWeight", { weight })}</Text>
        {animal.vaccineOverdue ? (
          <Text style={styles.alert}>{t("cheptel.pens.badgeVaccineLate")}</Text>
        ) : null}
        {animal.activeGestation ? (
          <Text style={styles.gestation}>{t("cheptel.actions.gestationActive")}</Text>
        ) : null}
      </View>
      <View style={styles.grid}>
        {actions.map((a) => (
          <Pressable key={a.key} style={styles.actionCell} onPress={a.onPress}>
            <Ionicons name={a.icon} size={24} color={mobileColors.accent} />
            <Text style={styles.actionLabel}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  headerMeta: { gap: 4, marginBottom: mobileSpacing.md },
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  alert: { color: mobileColors.error, fontWeight: "700", fontSize: 13 },
  gestation: { color: "#BE185D", fontWeight: "600", fontSize: 13 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  actionCell: {
    width: "31%",
    minWidth: 96,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    alignItems: "center",
    gap: 6
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    color: mobileColors.textPrimary
  }
});
