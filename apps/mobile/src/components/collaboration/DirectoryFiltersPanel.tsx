import { useTranslation } from "react-i18next";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";

const RADIUS_OPTIONS = [25, 50, 100, 200, 2000] as const;
const EXP_OPTIONS = [
  { labelKey: "any", value: 0 },
  { labelKey: "1", value: 1 },
  { labelKey: "3", value: 3 },
  { labelKey: "5", value: 5 },
  { labelKey: "10", value: 10 }
] as const;

const SPEC_OPTIONS = [
  "Alimentation",
  "Santé animale",
  "Reproduction",
  "Gestion cheptel",
  "Bâtiments / Infrastructure",
  "Tout terrain"
];

type Props = {
  visible: boolean;
  onClose: () => void;
  radiusKm: number;
  onRadiusKm: (km: number) => void;
  availableOnly: boolean;
  onAvailableOnly: (v: boolean) => void;
  experienceMin: number;
  onExperienceMin: (v: number) => void;
  specialization: string | null;
  onSpecialization: (v: string | null) => void;
  salaryMax: string;
  onSalaryMax: (v: string) => void;
};

export function DirectoryFiltersPanel({
  visible,
  onClose,
  radiusKm,
  onRadiusKm,
  availableOnly,
  onAvailableOnly,
  experienceMin,
  onExperienceMin,
  specialization,
  onSpecialization,
  salaryMax,
  onSalaryMax
}: Props) {
  const { t } = useTranslation();

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("collab.directory.filtersTitle")}
      footerPrimary={
        <PrimaryButton label={t("collab.directory.filtersApply")} onPress={onClose} />
      }
    >
      <Text style={styles.label}>{t("collab.directory.filterRadius")}</Text>
      <View style={styles.pills}>
        {RADIUS_OPTIONS.map((km) => (
          <Pressable
            key={km}
            style={[styles.pill, radiusKm === km && styles.pillOn]}
            onPress={() => onRadiusKm(km)}
          >
            <Text style={[styles.pillTx, radiusKm === km && styles.pillTxOn]}>
              {km >= 2000
                ? t("collab.directory.radiusCountry")
                : t("collab.directory.radiusKm", { km })}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t("collab.directory.availableOnly")}</Text>
        <Switch value={availableOnly} onValueChange={onAvailableOnly} />
      </View>

      <Text style={styles.label}>{t("collab.directory.filterExperience")}</Text>
      <View style={styles.pills}>
        {EXP_OPTIONS.map((o) => (
          <Pressable
            key={o.value}
            style={[styles.pill, experienceMin === o.value && styles.pillOn]}
            onPress={() => onExperienceMin(o.value)}
          >
            <Text
              style={[styles.pillTx, experienceMin === o.value && styles.pillTxOn]}
            >
              {t(`collab.directory.exp${o.labelKey}` as const)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>{t("collab.directory.filterSpecialization")}</Text>
      <View style={styles.pills}>
        {SPEC_OPTIONS.map((s) => (
          <Pressable
            key={s}
            style={[styles.pill, specialization === s && styles.pillOn]}
            onPress={() => onSpecialization(specialization === s ? null : s)}
          >
            <Text style={[styles.pillTx, specialization === s && styles.pillTxOn]}>
              {s}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>{t("collab.directory.filterSalaryMax")}</Text>
      <TextInput
        style={styles.input}
        value={salaryMax}
        onChangeText={onSalaryMax}
        keyboardType="numeric"
        placeholder={t("collab.directory.filterSalaryMaxPh")}
      />
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  label: {
    ...mobileTypography.meta,
    fontWeight: "700",
    marginTop: mobileSpacing.md,
    marginBottom: mobileSpacing.xs,
    color: mobileColors.textSecondary
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: mobileSpacing.md
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted
  },
  pillOn: {
    backgroundColor: mobileColors.accentSoft,
    borderWidth: 1,
    borderColor: mobileColors.accent
  },
  pillTx: { fontSize: mobileFontSize.sm, color: mobileColors.textSecondary },
  pillTxOn: { fontWeight: "700", color: mobileColors.accent },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: 12,
    backgroundColor: mobileColors.background
  }
});
