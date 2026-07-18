import { useMemo } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { AnimalListItem } from "../../lib/api";
import { useSession } from "../../context/SessionContext";
import {
  applyAnimalSelection,
  computeFlatLotTotal,
  computeTotalFromWeightAndPrice,
  formatDecimalForInput,
  isIndividualSelectionBlocked,
  listingFormHeadcount,
  parseDecimalField,
  suggestListingCategoryFromWeight,
  usesFlatListingPrice,
  listingCategoryAllowsCredit,
  type ListingWeightBasis,
  type ListingCategory,
  type ListingDurationDays,
  type MarketplaceListingFormValues
} from "../../lib/marketplaceListingForm";
import { computeSellerFeeBreakdown } from "../../lib/platformFees";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { PlatformFeePreview } from "../common/PlatformFeePreview";
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

const WEIGHT_BASES: ListingWeightBasis[] = ["live", "carcass"];

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
  /** Date d'expiration actuelle (mode édition). */
  editExpiresAt?: string | null;
  /** Prolonger l'annonce de X jours supplémentaires. */
  extendDuration?: boolean;
  onExtendDurationChange?: (extend: boolean) => void;
  /** Animaux déjà présents sur une annonce individuelle ouverte. */
  individualBlockedAnimalIds?: ReadonlySet<string>;
};

export function MarketplaceListingFormFields({
  values,
  onChange,
  farms,
  animals,
  farmsLoading,
  animalsLoading,
  lockFarm,
  showDuration,
  editExpiresAt,
  extendDuration,
  onExtendDurationChange,
  individualBlockedAnimalIds
}: Props) {
  const { t } = useTranslation();
  const { platformFees } = useSession();

  const set = (patch: Partial<MarketplaceListingFormValues>) =>
    onChange(patch);

  const activeAnimals = useMemo(
    () => animals.filter((a) => a.status === "active"),
    [animals]
  );

  const showIndividualListedHint = useMemo(
    () =>
      Boolean(
        individualBlockedAnimalIds?.size &&
          activeAnimals.some((a) => individualBlockedAnimalIds.has(a.id))
      ),
    [activeAnimals, individualBlockedAnimalIds]
  );

  const handleAnimalPress = (animal: AnimalListItem) => {
    const patch = applyAnimalSelection(values, animal, activeAnimals, true);
    const nextIds = patch.selectedAnimalIds ?? [];
    if (
      individualBlockedAnimalIds &&
      isIndividualSelectionBlocked(nextIds, individualBlockedAnimalIds)
    ) {
      Alert.alert(
        t("marketScreen.createForm.animalIndividualBlockedTitle"),
        t("marketScreen.createForm.animalIndividualBlockedBody")
      );
      return;
    }
    set(patch);
  };

  const computedTotal = useMemo(
    () => computeTotalFromWeightAndPrice(values.totalWeightKg, values.pricePerKg),
    [values.totalWeightKg, values.pricePerKg]
  );

  const flatPrice = usesFlatListingPrice(values.category);
  const headcount = listingFormHeadcount(values);
  const showWeightBasis =
    !flatPrice || parseDecimalField(values.totalWeightKg) != null;

  const flatLotTotal = useMemo(
    () => computeFlatLotTotal(values.pricePerHead, headcount),
    [values.pricePerHead, headcount]
  );

  const unitFeeBreakdown = useMemo(() => {
    const unit = flatPrice
      ? parseDecimalField(values.pricePerHead)
      : parseDecimalField(values.pricePerKg);
    if (unit == null) {
      return null;
    }
    return computeSellerFeeBreakdown(
      unit,
      platformFees.marketplaceSellerCommissionRate
    );
  }, [
    flatPrice,
    values.pricePerHead,
    values.pricePerKg,
    platformFees.marketplaceSellerCommissionRate
  ]);

  const displayTotal = flatPrice
    ? flatLotTotal != null
      ? formatDecimalForInput(flatLotTotal, 0)
      : values.totalPrice
    : values.totalPriceManual && values.totalPrice.trim()
      ? values.totalPrice
      : computedTotal != null
        ? formatDecimalForInput(computedTotal, 0)
        : values.totalPrice;

  const onWeightOrPriceChange = (
    patch: Partial<MarketplaceListingFormValues>
  ) => {
    const next = { ...values, ...patch };
    const nextFlat = usesFlatListingPrice(next.category);
    if (!nextFlat && !next.totalPriceManual) {
      const total = computeTotalFromWeightAndPrice(
        next.totalWeightKg,
        next.pricePerKg
      );
      if (total != null) {
        patch.totalPrice = formatDecimalForInput(total, 0);
      }
    }
    const weight = parseDecimalField(next.totalWeightKg);
    if (weight != null && weight > 0) {
      const headcount =
        next.selectedAnimalIds.length > 0
          ? next.selectedAnimalIds.length
          : next.animalId
            ? 1
            : 1;
      patch.category = suggestListingCategoryFromWeight(
        weight,
        headcount,
        next.category
      );
    } else if (nextFlat) {
      patch.weightBasis = null;
    }
    onChange(patch);
  };

  const onCategoryChange = (category: ListingCategory) => {
    const patch: Partial<MarketplaceListingFormValues> = { category };
    if (!listingCategoryAllowsCredit(category)) {
      patch.creditEnabled = false;
    }
    if (usesFlatListingPrice(category)) {
      patch.pricePerKg = "";
      patch.totalPriceManual = false;
      const lotTotal = computeFlatLotTotal(values.pricePerHead, headcount);
      if (lotTotal != null) {
        patch.totalPrice = formatDecimalForInput(lotTotal, 0);
      }
    } else if (usesFlatListingPrice(values.category)) {
      patch.pricePerHead = "";
      patch.totalPriceManual = false;
    }
    onChange(patch);
  };

  const onPricePerHeadChange = (pricePerHead: string) => {
    const lotTotal = computeFlatLotTotal(pricePerHead, headcount);
    onChange({
      pricePerHead,
      ...(lotTotal != null
        ? { totalPrice: formatDecimalForInput(lotTotal, 0) }
        : {})
    });
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
        <Text style={styles.hint}>{t("marketScreen.createForm.categoryHint")}</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              style={[styles.chip, values.category === cat && styles.chipOn]}
              onPress={() => onCategoryChange(cat)}
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
          {showIndividualListedHint ? (
            <Text style={styles.hint}>
              {t("marketScreen.createForm.animalIndividualListedHint")}
            </Text>
          ) : null}
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
                const hasIndividualElsewhere =
                  individualBlockedAnimalIds?.has(a.id) ?? false;
                return (
                  <Pressable
                    key={a.id}
                    style={[
                      styles.chip,
                      selected && styles.chipOn,
                      hasIndividualElsewhere && !selected && styles.chipSolo
                    ]}
                    onPress={() => handleAnimalPress(a)}
                  >
                    <Text
                      style={[
                        styles.chipTx,
                        selected && styles.chipTxOn,
                        hasIndividualElsewhere && !selected && styles.chipTxSolo
                      ]}
                      numberOfLines={1}
                    >
                      {hasIndividualElsewhere && !selected ? "solo · " : ""}
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

      <ModalSection
        title={
          flatPrice
            ? t("marketScreen.createForm.sectionPricingFlat")
            : t("marketScreen.createForm.sectionPricingPork")
        }
      >
        {flatPrice ? (
          <Text style={styles.hint}>
            {t("marketScreen.createForm.flatPriceHint")}
          </Text>
        ) : null}
        <Text style={styles.lab}>
          {flatPrice
            ? t("marketScreen.createForm.weightOptional")
            : `${t("marketScreen.createForm.totalWeight")} *`}
        </Text>
        <TextInput
          style={styles.input}
          value={values.totalWeightKg}
          onChangeText={(totalWeightKg) =>
            onWeightOrPriceChange({
              totalWeightKg,
              totalPriceManual: flatPrice ? true : false
            })
          }
          placeholder="0"
          placeholderTextColor={mobileColors.textSecondary}
          keyboardType="decimal-pad"
        />

        {showWeightBasis ? (
          <>
            <Text style={styles.lab}>
              {t("marketScreen.createForm.weightBasisLabel")} *
            </Text>
            <Text style={styles.hint}>
              {t("marketScreen.createForm.weightBasisHint")}
            </Text>
            <View style={styles.basisRow}>
              {WEIGHT_BASES.map((basis) => {
                const selected = values.weightBasis === basis;
                return (
                  <Pressable
                    key={basis}
                    style={styles.basisOption}
                    onPress={() => set({ weightBasis: basis })}
                  >
                    <Text style={styles.checkMark}>{selected ? "☑" : "☐"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.basisTitle}>
                        {t(`marketScreen.weightBasis.${basis}`)}
                      </Text>
                      <Text style={styles.basisHint}>
                        {t(`marketScreen.weightBasis.${basis}Hint`)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {!flatPrice ? (
          <>
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
          </>
        ) : (
          <>
            <Text style={styles.lab}>
              {t("marketScreen.createForm.pricePerHead")} *
            </Text>
            <TextInput
              style={styles.input}
              value={values.pricePerHead}
              onChangeText={onPricePerHeadChange}
              placeholder="28000"
              placeholderTextColor={mobileColors.textSecondary}
              keyboardType="decimal-pad"
            />
          </>
        )}

        <Text style={styles.lab}>
          {flatPrice
            ? t("marketScreen.createForm.lotTotalPrice")
            : `${t("marketScreen.createForm.totalPrice")} *`}
        </Text>
        {flatPrice ? (
          <>
            <Text style={styles.totalReadonly}>{displayTotal || "—"}</Text>
            {flatLotTotal != null && headcount > 0 ? (
              <Text style={styles.calcHint}>
                {t("marketScreen.createForm.flatLotAuto", {
                  count: headcount,
                  perHead: formatMarketMoney(
                    parseDecimalField(values.pricePerHead) ?? 0,
                    values.currency
                  ),
                  amount: formatMarketMoney(flatLotTotal, values.currency)
                })}
              </Text>
            ) : null}
          </>
        ) : (
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
        )}
        {!flatPrice && !values.totalPriceManual && computedTotal != null ? (
          <Text style={styles.calcHint}>
            {t("marketScreen.createForm.totalAuto", {
              amount: formatMarketMoney(computedTotal, values.currency)
            })}
          </Text>
        ) : null}

        <PlatformFeePreview
          breakdown={unitFeeBreakdown}
          currency={values.currency || "XOF"}
          unitLabelKey={
            flatPrice
              ? "platformFees.unitPerHead"
              : "platformFees.unitPerKg"
          }
        />

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

      {listingCategoryAllowsCredit(values.category) ? (
        <ModalSection title={t("marketScreen.createForm.sectionCredit")}>
          <Text style={styles.hint}>
            {t("marketScreen.createForm.creditEnabledHint")}
          </Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {t("marketScreen.createForm.creditEnabledLabel")}
            </Text>
            <Switch
              value={values.creditEnabled}
              onValueChange={(creditEnabled) => set({ creditEnabled })}
              trackColor={{
                false: mobileColors.border,
                true: mobileColors.accent
              }}
              thumbColor={mobileColors.background}
            />
          </View>
        </ModalSection>
      ) : null}

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

      {editExpiresAt != null ? (
        <ModalSection
          title={t("marketScreen.editForm.sectionDuration", {
            defaultValue: "Durée de l'annonce"
          })}
        >
          <Text style={styles.hint}>
            {t("marketScreen.editForm.expiresAt", {
              defaultValue: "Expire le {{date}}",
              date: new Date(editExpiresAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric"
              })
            })}
          </Text>
          <Pressable
            style={[styles.chip, extendDuration && styles.chipOn]}
            onPress={() => onExtendDurationChange?.(!extendDuration)}
          >
            <Text style={[styles.chipTx, extendDuration && styles.chipTxOn]}>
              {t("marketScreen.editForm.extendToggle", {
                defaultValue: "Prolonger l'annonce"
              })}
            </Text>
          </Pressable>
          {extendDuration ? (
            <>
              <Text style={styles.hint}>
                {t("marketScreen.editForm.extendHint", {
                  defaultValue: "Ajouter des jours supplémentaires :"
                })}
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
                      +{d}j
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </ModalSection>
      ) : null}

      {editExpiresAt == null ? (
        <Text style={styles.footerNote}>{t("marketScreen.createForm.footerNote")}</Text>
      ) : null}
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
  chipSolo: {
    borderStyle: "dashed",
    opacity: 0.92
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
  chipTxSolo: {
    color: mobileColors.textSecondary
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    lineHeight: 18,
    marginBottom: mobileSpacing.xs
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.md,
    paddingVertical: mobileSpacing.xs
  },
  switchLabel: {
    flex: 1,
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  calcHint: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    marginTop: 4
  },
  totalReadonly: {
    ...mobileTypography.body,
    fontWeight: "700",
    fontSize: 20,
    color: mobileColors.textPrimary,
    paddingVertical: mobileSpacing.sm
  },
  footerNote: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    lineHeight: 18,
    marginTop: mobileSpacing.xs
  },
  basisRow: {
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.xs
  },
  basisOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.sm,
    paddingVertical: mobileSpacing.xs
  },
  checkMark: {
    fontSize: 18,
    lineHeight: 22
  },
  basisTitle: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  basisHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  }
});
