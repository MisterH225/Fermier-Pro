import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildE164Phone,
  PHONE_DIAL_COUNTRIES,
  type DialCountry
} from "../lib/phoneDialCountries";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";

function defaultCiCountry(): DialCountry {
  return (
    PHONE_DIAL_COUNTRIES.find((c) => c.iso2 === "CI") ?? PHONE_DIAL_COUNTRIES[0]!
  );
}

type Props = {
  /** Numéro E.164 (préfixe + local). Chaîne vide si le local est vide. */
  value: string;
  onChange: (e164: string) => void;
  placeholder?: string;
  editable?: boolean;
  /** Affiche l’aide sous le champ (défaut : true). */
  showHint?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Champ téléphone avec indicatif pays à gauche (défaut +225).
 * L’utilisateur saisit uniquement le numéro local ; concaténation avant API.
 */
export function PhoneInput({
  value,
  onChange,
  placeholder,
  editable = true,
  showHint = true,
  style,
  testID
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [country, setCountry] = useState<DialCountry>(defaultCiCountry);
  const [national, setNational] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState("");

  // Reset local si le parent vide la valeur (ex. après succès).
  useEffect(() => {
    if (!value.trim() && national) {
      setNational("");
    }
  }, [value, national]);

  const emit = (nextCountry: DialCountry, nextNational: string) => {
    const trimmed = nextNational.trim();
    if (!trimmed) {
      onChange("");
      return;
    }
    onChange(buildE164Phone(nextCountry.dial, trimmed));
  };

  const filteredCountries = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return PHONE_DIAL_COUNTRIES;
    return PHONE_DIAL_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.replace("+", "").includes(q) ||
        c.iso2.toLowerCase().includes(q)
    );
  }, [filter]);

  return (
    <View style={style} testID={testID}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.prefix, !editable && styles.disabled]}
          onPress={() => {
            if (!editable) return;
            setFilter("");
            setModalOpen(true);
          }}
          disabled={!editable}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={t("phoneInput.countryA11y", {
            country: country.name,
            dial: country.dial
          })}
        >
          <Text style={styles.flag}>{country.flag}</Text>
          <Text style={styles.dial}>{country.dial}</Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={mobileColors.textSecondary}
          />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, !editable && styles.disabled]}
          value={national}
          onChangeText={(text) => {
            setNational(text);
            emit(country, text);
          }}
          placeholder={placeholder ?? t("phoneInput.nationalPlaceholder")}
          placeholderTextColor={mobileColors.textSecondary}
          keyboardType="phone-pad"
          autoComplete="tel-national"
          textContentType="telephoneNumber"
          editable={editable}
        />
      </View>
      {showHint ? (
        <Text style={styles.hint}>{t("phoneInput.nationalHint")}</Text>
      ) : null}

      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setModalOpen(false)}
        >
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 }
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {t("phoneInput.countryModalTitle")}
              </Text>
              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={mobileColors.textPrimary}
                />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.search}
              placeholder={t("phoneInput.countrySearchPlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
              value={filter}
              onChangeText={setFilter}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.iso2}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => {
                const on = item.iso2 === country.iso2;
                return (
                  <TouchableOpacity
                    style={[styles.option, on && styles.optionOn]}
                    onPress={() => {
                      setCountry(item);
                      setModalOpen(false);
                      setFilter("");
                      emit(item, national);
                    }}
                  >
                    <Text style={styles.optionFlag}>{item.flag}</Text>
                    <View style={styles.optionText}>
                      <Text style={styles.optionName}>{item.name}</Text>
                      <Text style={styles.optionDial}>{item.dial}</Text>
                    </View>
                    {on ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={mobileColors.accent}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.empty}>{t("phoneInput.countryEmpty")}</Text>
              }
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: mobileSpacing.sm
  },
  prefix: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: mobileSpacing.sm + 2,
    minWidth: 100,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted
  },
  flag: { fontSize: mobileFontSize.lg },
  dial: {
    fontSize: mobileFontSize.md,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  input: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm + 2,
    fontSize: mobileFontSize.lg,
    backgroundColor: mobileColors.surfaceMuted,
    color: mobileColors.textPrimary
  },
  disabled: { opacity: 0.55 },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs,
    lineHeight: 18
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: mobileColors.background,
    borderTopLeftRadius: mobileRadius.xl,
    borderTopRightRadius: mobileRadius.xl,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    maxHeight: "70%",
    gap: mobileSpacing.sm
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sheetTitle: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  search: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    fontSize: mobileFontSize.md,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.surfaceMuted
  },
  list: { maxHeight: 360 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  optionOn: { backgroundColor: mobileColors.accentSoft },
  optionFlag: { fontSize: mobileFontSize.xl },
  optionText: { flex: 1, minWidth: 0 },
  optionName: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  optionDial: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  empty: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center",
    paddingVertical: mobileSpacing.lg
  }
});
