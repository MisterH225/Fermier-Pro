import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { AnimalListItem } from "../../lib/api";
import {
  applyAnimalSelection,
  computeTotalFromWeightAndPrice,
  formatDecimalForInput,
  type ListingCategory,
  type ListingDurationDays,
  type MarketplaceListingFormValues
} from "../../lib/marketplaceListingForm";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { ModalSection } from "../modals/ModalSection";
import { formatMarketMoney } from "./MarketplaceListingCard";

export type { MarketplaceListingFormValues } from "../../lib/marketplaceListingForm";

const CATEGORIES: ListingCategory[] = [
  "piglet",
  "breeder",
  "butcher",
  "reformed"
];

const DURATIONS: ListingDurationDays[] = [7, 14, 30];

type FarmRow = { id: string; name: string };

type Props = {
  values: MarketplaceListingFormValues;
  onChange: (patch: Partial<MarketplaceListingFormValues>) => void;
  farms: FarmRow[];
  animals: AnimalListItem[];
  farmsLoading?: boolean;
  animalsLoading?: boolean;
  lockFarm?: boolean;
  /** Affiche le choix de durée (publication). */
  showDuration?: boolean;
};

export function MarketplaceListingFormFields({
  values,
  onChange,
  farms,
  animals,
  farmsLoading,
  animalsLoading,
  lockFarm,
  showDuration
}: Props) {
  const { t } = useTranslation();

  const set = (patch: Partial<MarketplaceListingFormValues>) =>
    onChange(patch);

  const activeAnimals = useMemo(
    () => animals.filter((a) => a.status === "active"),
    [animals]
  );

  const computedTotal = useMemo(
    () => computeTotalFromWeightAndPrice(values.totalWeightKg, values.pricePerKg),
    [values.totalWeightKg, values.pricePerKg]
  );

  const displayTotal =
    values.totalPriceManual && values.totalPrice.trim()
      ? values.totalPrice
      : computedTotal != null
        ? formatDecimalForInput(computedTotal, 0)
        : values.totalPrice;

  const onWeightOrPriceChange = (
    patch: Partial<MarketplaceListingFormValues>
  ) => {
    const next = { ...values, ...patch };
    if (!next.totalPriceManual) {
      const total = computeTotalFromWeightAndPrice(
        next.totalWeightKg,
        next.pricePerKg
      );
      if (total != null) {
        patch.totalPrice = formatDecimalForInput(total, 0);
      }
    }
    onChange(patch);
  };

  return (
    <>
      {!lockFarm ? (
        <ModalSection title={t("marketScreen.createForm.sectionFarm")}>
          {farmsLoading ? (
            <ActivityIndicator color={mobileColors.accent} />
          ) : (
            <>
              <View style={styles.chipRow}>
                <Pressable
                  style={[styles.chip, values.farmId === null && styles.chipOn]}
                  onPress={() =>
                    set({
                      farmId: null,
                      animalId: null,
                      selectedAnimalIds: []
                    })
                  }
                >
                  <Text
                    style={[
                      styles.chipTx,
                      values.farmId === null && styles.chipTxOn
                    ]}
                  >
                    {t("marketScreen.createForm.noFarm")}
                  </Text>
                </Pressable>
                {farms.map((f) => (
                  <Pressable
                    key={f.id}
                    style={[styles.chip, values.farmId === f.id && styles.chipOn]}
                    onPress={() =>
                      set({
                        farmId: f.id,
                        animalId: null,
                        selectedAnimalIds: []
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.chipTx,
                        values.farmId === f.id && styles.chipTxOn
                      ]}
                    >
                      {f.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.hint}>{t("marketScreen.createForm.farmHint")}</Text>
            </>
          )}
        </ModalSection>
      ) : null}

      <ModalSection title={t("marketScreen.createForm.sectionCategory")}>
        <View style={styles.chipRow}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              style={[styles.chip, values.category === cat && styles.chipOn]}
              onPress={() => set({ category: cat })}
            >
              <Text
                style={[
                  styles.chipTx,
                  values.category === cat && styles.chipTxOn
                ]}
              >
                {t(`marketScreen.categories.${cat}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ModalSection>

      {values.farmId ? (
        <ModalSection title={t("marketScreen.createForm.sectionAnimal")}>
          <Text style={styles.hint}>{t("marketScreen.createForm.animalMultiHint")}</Text>
          {animalsLoading ? (
            <ActivityIndicator color={mobileColors.accent} />
          ) : activeAnimals.length === 0 ? (
            <Text style={styles.hint}>
              {t("marketScreen.createForm.noActiveAnimals")}
            </Text>
          ) : (
            <View style={styles.chipRow}>
              {activeAnimals.map((a) => {
                const selected = values.selectedAnimalIds.includes(a.id);
                return (
                  <Pressable
                    key={a.id}
                    style={[styles.chip, selected && styles.chipOn]}
                    onPress={() =>
                      set(
                        applyAnimalSelection(
                          values,
                          a,
                          activeAnimals,
                          true
                        )
                      )
                    }
                  >
                    <Text
                      style={[styles.chipTx, selected && styles.chipTxOn]}
                      numberOfLines={1}
                    >
                      {a.tagCode?.trim() || a.publicId.slice(0, 8)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ModalSection>
      ) : null}

      <ModalSection title={t("marketScreen.createForm.sectionListing")}>
        <Text style={styles.lab}>{t("marketScreen.createForm.title")} *</Text>
        <TextInput
          style={styles.input}
          value={values.title}
          onChangeText={(title) => set({ title })}
          placeholder={t("marketScreen.createForm.titlePlaceholder")}
          placeholderTextColor={mobileColors.textSecondary}
        />

        <Text style={styles.lab}>{t("marketScreen.createForm.description")}</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={values.description}
          onChangeText={(description) => set({ description })}
          placeholder={t("marketScreen.createForm.descriptionPlaceholder")}
          placeholderTextColor={mobileColors.textSecondary}
          multiline
        />

        <Text style={styles.lab}>{t("marketScreen.createForm.breedLabel")}</Text>
        <TextInput
          style={styles.input}
          value={values.breedLabel}
          onChangeText={(breedLabel) => set({ breedLabel })}
          placeholder={t("marketScreen.createForm.breedPlaceholder")}
          placeholderTextColor={mobileColors.textSecondary}
        />
      </ModalSection>

      <ModalSection title={t("marketScreen.createForm.sectionPricingPork")}>
        <Text style={styles.lab}>
          {t("marketScreen.createForm.totalWeight")} *
        </Text>
        <TextInput
          style={styles.input}
          value={values.totalWeightKg}
          onChangeText={(totalWeightKg) =>
            onWeightOrPriceChange({ totalWeightKg, totalPriceManual: false })
          }
          placeholder="0"
          placeholderTextColor={mobileColors.textSecondary}
          keyboardType="decimal-pad"
        />

        <Text style={styles.lab}>
          {t("marketScreen.createForm.pricePerKg")} *
        </Text>
        <TextInput
          style={styles.input}
          value={values.pricePerKg}
          onChangeText={(pricePerKg) =>
            onWeightOrPriceChange({ pricePerKg, totalPriceManual: false })
          }
          placeholder="0"
          placeholderTextColor={mobileColors.textSecondary}
          keyboardType="decimal-pad"
        />

        <Text style={styles.lab}>
          {t("marketScreen.createForm.totalPrice")} *
        </Text>
        <TextInput
          style={styles.input}
          value={displayTotal}
          onChangeText={(totalPrice) =>
            set({ totalPrice, totalPriceManual: true })
          }
          placeholder="0"
          placeholderTextColor={mobileColors.textSecondary}
          keyboardType="decimal-pad"
        />
        {!values.totalPriceManual && computedTotal != null ? (
          <Text style={styles.calcHint}>
            {t("marketScreen.createForm.totalAuto", {
              amount: formatMarketMoney(computedTotal, values.currency)
            })}
          </Text>
        ) : null}

        <Text style={styles.lab}>{t("marketScreen.createForm.currency")}</Text>
        <TextInput
          style={styles.input}
          value={values.currency}
          onChangeText={(currency) => set({ currency })}
          placeholder="XOF"
          placeholderTextColor={mobileColors.textSecondary}
          autoCapitalize="characters"
        />
      </ModalSection>

      <ModalSection title={t("marketScreen.createForm.sectionLocation")}>
        <Text style={styles.lab}>{t("marketScreen.createForm.location")}</Text>
        <TextInput
          style={styles.input}
          value={values.locationLabel}
          onChangeText={(locationLabel) => set({ locationLabel })}
          placeholder={t("marketScreen.createForm.locationPlaceholder")}
          placeholderTextColor={mobileColors.textSecondary}
        />
      </ModalSection>

      {showDuration ? (
        <ModalSection title={t("marketScreen.createForm.sectionDuration")}>
          <Text style={styles.hint}>
            {t("marketScreen.createForm.durationHint")}
          </Text>
          <View style={styles.chipRow}>
            {DURATIONS.map((d) => (
              <Pressable
                key={d}
                style={[
                  styles.chip,
                  values.publishDurationDays === d && styles.chipOn
                ]}
                onPress={() => set({ publishDurationDays: d })}
              >
                <Text
                  style={[
                    styles.chipTx,
                    values.publishDurationDays === d && styles.chipTxOn
                  ]}
                >
                  {t("marketScreen.createForm.durationDays", { count: d })}
                </Text>
              </Pressable>
            ))}
          </View>
        </ModalSection>
      ) : null}

      <Text style={styles.footerNote}>{t("marketScreen.createForm.footerNote")}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  lab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4,
    marginTop: mobileSpacing.xs
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.surfaceMuted
  },
  inputMulti: {
    minHeight: 96,
    textAlignVertical: "top"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.xs
  },
  chip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.surfaceMuted
  },
  chipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  chipTx: {
    ...mobileTypography.body,
    fontSize: 14,
    color: mobileColors.textPrimary
  },
  chipTxOn: {
    color: mobileColors.accent,
    fontWeight: "600"
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    lineHeight: 18,
    marginBottom: mobileSpacing.xs
  },
  calcHint: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    marginTop: 4
  },
  footerNote: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    lineHeight: 18,
    marginTop: mobileSpacing.xs
  }
});
