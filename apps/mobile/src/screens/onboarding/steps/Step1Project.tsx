import * as Location from "expo-location";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { useOnboarding } from "../../../hooks/useOnboarding";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../../theme/mobileTheme";

type Ob = ReturnType<typeof useOnboarding>;

type Props = {
  ob: Ob;
};

export function Step1Project({ ob }: Props) {
  const { t } = useTranslation();
  const { form, patch } = ob;

  const useGps = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("", t("producer.gpsDenied"));
      return;
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    patch({
      location: {
        mode: "gps",
        latitude: lat,
        longitude: lng,
        label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      }
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("onboarding.step1.title")}</Text>
      <Text style={styles.sub}>{t("onboarding.step1.subtitle")}</Text>

      <Text style={styles.label}>{t("onboarding.step1.farmName")} *</Text>
      <TextInput
        style={styles.input}
        value={form.farmName}
        onChangeText={(farmName) => patch({ farmName })}
        placeholder={t("onboarding.step1.farmPlaceholder")}
        placeholderTextColor={mobileColors.textSecondary}
      />

      <Text style={styles.label}>{t("onboarding.step1.species")} *</Text>
      <View style={styles.pillRow}>
        <View style={[styles.pill, styles.pillOn]}>
          <Text style={[styles.pillText, styles.pillTextOn]}>
            {t("onboarding.step1.speciesPig")}
          </Text>
        </View>
      </View>

      <Text style={styles.label}>{t("onboarding.step1.location")} *</Text>
      <Pressable style={styles.option} onPress={() => void useGps()}>
        <Text style={styles.optionText}>{t("onboarding.step1.useGps")}</Text>
      </Pressable>
      <Text style={styles.or}>{t("onboarding.step1.or")}</Text>
      <TextInput
        style={styles.input}
        value={
          form.location?.mode === "manual" ? form.location.label : ""
        }
        onChangeText={(label) =>
          patch({ location: { mode: "manual", label } })
        }
        placeholder={t("onboarding.step1.manualPlaceholder")}
        placeholderTextColor={mobileColors.textSecondary}
      />
      {form.location?.mode === "gps" ? (
        <Text style={styles.hint}>{form.location.label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm },
  title: { ...mobileTypography.title, fontSize: mobileFontSize.xl },
  sub: { ...mobileTypography.meta, color: mobileColors.textSecondary, marginBottom: 8 },
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 12,
    ...mobileTypography.body,
    backgroundColor: mobileColors.background
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  pillOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  pillText: { ...mobileTypography.body },
  pillTextOn: { color: mobileColors.accent, fontWeight: "700" },
  option: {
    borderWidth: 1,
    borderColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    padding: 14,
    backgroundColor: mobileColors.accentSoft
  },
  optionText: { color: mobileColors.accent, fontWeight: "600" },
  or: {
    textAlign: "center",
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  hint: { ...mobileTypography.meta, color: mobileColors.success }
});
