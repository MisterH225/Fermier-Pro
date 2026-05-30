import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppDatePicker } from "../common/AppDatePicker";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
  farmId?: string;
};

/** Échéance tâche — sélecteur visuel (plus de saisie manuelle). */
export function TaskDueDateField({ value, onChange, farmId }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <AppDatePicker
        isoValue={value}
        onIsoChange={onChange}
        farmId={farmId}
        placeholder={t("tasksScreen.dueDateNone")}
      />
      {value.trim() ? (
        <Pressable onPress={() => onChange("")} style={styles.clearBtn}>
          <Text style={styles.clearTx}>{t("tasksScreen.dueDateClear")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: mobileSpacing.xs },
  clearBtn: { alignSelf: "flex-start", paddingVertical: mobileSpacing.xs },
  clearTx: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  }
});
