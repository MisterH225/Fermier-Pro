import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileCompletionGauge } from "../../../components/common/ProfileCompletionGauge";
import { buyerPalette } from "../../../components/common/rolePalette";
import {
  ProfileHeroCard,
  profileScreenScrollContent,
  ScreenSection
} from "../../../components/layout";
import { FarmMapPickerModal } from "../../../components/producer/FarmMapPickerModal";
import { DualRangeSlider } from "../../../components/ui/DualRangeSlider";
import { useSession } from "../../../context/SessionContext";
import { upsertBuyerProfile } from "../../../lib/api";
import { formatApiError } from "../../../lib/apiErrors";
import { queueBuyerMarketLaunch } from "../../../lib/buyerOnboardingLaunch";
import { buyerProfileFromOnboarding } from "../../../lib/buyerOnboardingSnapshot";
import { pickNonBuyerFallbackProfileId } from "../../../lib/buyerOnboardingState";
import {
  buyerProfileCompletionPercent,
  buyerProfileNextEmptyField
} from "../../../lib/buyerProfileCompletion";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../../theme/mobileTheme";
import { buyerColors, buyerRadius } from "../../../theme/buyerTheme";

const BUYER_TYPES = [
  "individual",
  "slaughterhouse",
  "wholesaler",
  "reseller",
  "other"
] as const;
const CATEGORIES = [
  "piglet",
  "breeder_male",
  "breeder_female",
  "butcher",
  "reformed"
] as const;
const VOLUMES = ["1-5", "5-20", "20-50", "50+"] as const;
const RADIUS_PRESETS = [10, 25, 50, 100] as const;

/** Fourchette marché indicative (F CFA / kg). */
const PRICE_MIN = 500;
const PRICE_MAX = 5000;
const PRICE_STEP = 50;
const PRICE_DEFAULT_LOW = 1000;
const PRICE_DEFAULT_HIGH = 2500;

type Props = {
  onFinished: () => void;
  onCancel: () => void;
};

export function BuyerOnboardingScreen({ onFinished, onCancel }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe, refreshAuthMe, setActiveProfileId } =
    useSession();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const [buyerType, setBuyerType] = useState<string>("individual");
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [typicalVolume, setTypicalVolume] = useState<string>(VOLUMES[0]);

  const [priceLow, setPriceLow] = useState(PRICE_DEFAULT_LOW);
  const [priceHigh, setPriceHigh] = useState(PRICE_DEFAULT_HIGH);
  const [priceSkipped, setPriceSkipped] = useState(false);
  const [searchRadiusKm, setSearchRadiusKm] = useState<number | null>(25);
  const [locationLabel, setLocationLabel] = useState(
    authMe?.user.homeLocationLabel ?? ""
  );
  const [homeLatitude, setHomeLatitude] = useState<number | null>(
    authMe?.user.homeLatitude ?? null
  );
  const [homeLongitude, setHomeLongitude] = useState<number | null>(
    authMe?.user.homeLongitude ?? null
  );

  const toggleCat = (c: string) => {
    setPreferredCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const snapshot = useMemo(
    () =>
      buyerProfileFromOnboarding({
        buyerType,
        preferredCategories,
        typicalVolume,
        locationLabel,
        homeLatitude,
        homeLongitude,
        searchRadiusKm,
        priceRangeMin: priceSkipped ? null : priceLow,
        priceRangeMax: priceSkipped ? null : priceHigh
      }),
    [
      buyerType,
      preferredCategories,
      typicalVolume,
      locationLabel,
      homeLatitude,
      homeLongitude,
      searchRadiusKm,
      priceSkipped,
      priceLow,
      priceHigh
    ]
  );

  const completion = buyerProfileCompletionPercent(snapshot);
  const nextField = buyerProfileNextEmptyField(snapshot);
  const nextHint = nextField
    ? t(`buyer.account.nextField.${nextField}`)
    : null;

  const persist = async () => {
    if (!accessToken) return;
    await upsertBuyerProfile(accessToken, activeProfileId, {
      buyerType,
      preferredCategories,
      typicalVolume,
      locationLabel: locationLabel.trim() || undefined,
      homeLatitude: homeLatitude ?? undefined,
      homeLongitude: homeLongitude ?? undefined,
      searchRadiusKm: searchRadiusKm ?? undefined,
      priceRangeMin: priceSkipped ? undefined : priceLow,
      priceRangeMax: priceSkipped ? undefined : priceHigh,
      onboardingComplete: true
    });
    await refreshAuthMe();
  };

  const finishToMarket = async () => {
    setBusy(true);
    setError(null);
    try {
      await persist();
      queueBuyerMarketLaunch({
        segment: "listings",
        priceRangeMin: priceSkipped ? undefined : priceLow,
        priceRangeMax: priceSkipped ? undefined : priceHigh,
        searchRadiusKm: searchRadiusKm ?? undefined,
        preferredCategory: preferredCategories[0],
        searchQuery: locationLabel.trim() || undefined
      });
      onFinished();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const finishToApp = async () => {
    setBusy(true);
    setError(null);
    try {
      await persist();
      onFinished();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onSkipProfile = async () => {
    const fallback = authMe
      ? pickNonBuyerFallbackProfileId(authMe, activeProfileId)
      : null;
    if (fallback) {
      await setActiveProfileId(fallback);
    }
    onCancel();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={profileScreenScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => void onSkipProfile()} style={styles.skip}>
          <Text style={styles.skipText}>{t("buyerOnboarding.skip")}</Text>
        </Pressable>

        <Text style={styles.stepLabel}>
          {t("buyerOnboarding.step", { current: step + 1, total: 3 })}
        </Text>

        {step === 0 ? (
          <>
            <ProfileHeroCard>
              <Text style={styles.heroTitle}>
                {t("buyerOnboarding.stepPrefsTitle")}
              </Text>
              <Text style={styles.heroBody}>
                {t("buyerOnboarding.stepPrefsBody")}
              </Text>
            </ProfileHeroCard>
            <ScreenSection title={t("buyerOnboarding.sectionType")}>
              <View style={styles.chips}>
                {BUYER_TYPES.map((bt) => (
                  <Pressable
                    key={bt}
                    style={[styles.chip, buyerType === bt && styles.chipActive]}
                    onPress={() => setBuyerType(bt)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        buyerType === bt && styles.chipTextActive
                      ]}
                    >
                      {t(`buyerOnboarding.type.${bt}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScreenSection>
            <ScreenSection title={t("buyerOnboarding.sectionCategories")}>
              <View style={styles.chips}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    style={[
                      styles.chip,
                      preferredCategories.includes(c) && styles.chipActive
                    ]}
                    onPress={() => toggleCat(c)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        preferredCategories.includes(c) && styles.chipTextActive
                      ]}
                    >
                      {t(`buyerOnboarding.cat.${c}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScreenSection>
            <ScreenSection title={t("buyerOnboarding.volume")}>
              <View style={styles.chips}>
                {VOLUMES.map((v) => (
                  <Pressable
                    key={v}
                    style={[styles.chip, typicalVolume === v && styles.chipActive]}
                    onPress={() => setTypicalVolume(v)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        typicalVolume === v && styles.chipTextActive
                      ]}
                    >
                      {t(`buyerOnboarding.vol.${v}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScreenSection>
            <Pressable style={styles.primary} onPress={() => setStep(1)}>
              <Text style={styles.primaryLabel}>
                {t("buyerOnboarding.continue")}
              </Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => setStep(1)}>
              <Text style={styles.secondaryLabel}>
                {t("buyerOnboarding.skipStep")}
              </Text>
            </Pressable>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <ProfileHeroCard>
              <Text style={styles.heroTitle}>
                {t("buyerOnboarding.stepSeekTitle")}
              </Text>
              <Text style={styles.heroBody}>
                {t("buyerOnboarding.stepSeekBody")}
              </Text>
            </ProfileHeroCard>

            <ScreenSection title={t("buyerOnboarding.priceRange")}>
              <Text style={styles.hint}>{t("buyerOnboarding.priceRangeHint")}</Text>
              <DualRangeSlider
                min={PRICE_MIN}
                max={PRICE_MAX}
                step={PRICE_STEP}
                low={priceLow}
                high={priceHigh}
                onChange={(lo, hi) => {
                  setPriceSkipped(false);
                  setPriceLow(lo);
                  setPriceHigh(hi);
                }}
                formatValue={(n) =>
                  t("buyerOnboarding.priceValue", { price: n })
                }
                trackColor={buyerColors.primaryLight}
                fillColor={buyerColors.primary}
                thumbColor={buyerColors.primary}
                labelColor={buyerColors.textPrimary}
              />
              <Pressable
                style={styles.skipField}
                onPress={() => setPriceSkipped(true)}
              >
                <Text style={styles.skipFieldTx}>
                  {t("buyerOnboarding.skipPrice")}
                </Text>
              </Pressable>
              {priceSkipped ? (
                <Text style={styles.skippedNote}>
                  {t("buyerOnboarding.priceSkipped")}
                </Text>
              ) : null}
            </ScreenSection>

            <ScreenSection title={t("buyerOnboarding.searchRadius")}>
              <View style={styles.chips}>
                {RADIUS_PRESETS.map((km) => (
                  <Pressable
                    key={km}
                    style={[
                      styles.chip,
                      searchRadiusKm === km && styles.chipActive
                    ]}
                    onPress={() => setSearchRadiusKm(km)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        searchRadiusKm === km && styles.chipTextActive
                      ]}
                    >
                      {t("buyerOnboarding.radiusKm", { km })}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={styles.skipField}
                onPress={() => setSearchRadiusKm(null)}
              >
                <Text style={styles.skipFieldTx}>
                  {t("buyerOnboarding.skipRadius")}
                </Text>
              </Pressable>
            </ScreenSection>

            <ScreenSection title={t("buyerOnboarding.location")}>
              <TextInput
                style={styles.input}
                value={locationLabel}
                onChangeText={setLocationLabel}
                placeholder={t("buyerOnboarding.locationPh")}
                placeholderTextColor={buyerColors.textMuted}
              />
              <Pressable
                style={styles.mapBtn}
                onPress={() => setMapOpen(true)}
              >
                <Text style={styles.mapBtnTx}>
                  {t("buyerOnboarding.pickOnMap")}
                </Text>
              </Pressable>
              <Pressable
                style={styles.skipField}
                onPress={() => {
                  setLocationLabel("");
                  setHomeLatitude(null);
                  setHomeLongitude(null);
                }}
              >
                <Text style={styles.skipFieldTx}>
                  {t("buyerOnboarding.skipLocation")}
                </Text>
              </Pressable>
            </ScreenSection>

            <Pressable style={styles.primary} onPress={() => setStep(2)}>
              <Text style={styles.primaryLabel}>
                {t("buyerOnboarding.continue")}
              </Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => setStep(0)}>
              <Text style={styles.secondaryLabel}>{t("buyerOnboarding.back")}</Text>
            </Pressable>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <ProfileHeroCard>
              <Text style={styles.heroTitle}>
                {t("buyerOnboarding.recapTitle")}
              </Text>
              <Text style={styles.heroBody}>
                {t("buyerOnboarding.recapBody")}
              </Text>
            </ProfileHeroCard>

            <ProfileCompletionGauge
              percent={completion}
              palette={buyerPalette}
              label={t("buyer.account.completionLabel")}
              hint={nextHint}
              animated
            />

            {error ? (
              <ScreenSection title={t("buyerOnboarding.sectionError")}>
                <Text style={styles.error}>{error}</Text>
              </ScreenSection>
            ) : null}

            <Pressable
              style={styles.primary}
              onPress={() => void finishToMarket()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={mobileColors.onAccent} />
              ) : (
                <Text style={styles.primaryLabel}>
                  {t("buyerOnboarding.discoverMarket")}
                </Text>
              )}
            </Pressable>
            <Pressable
              style={styles.secondary}
              onPress={() => void finishToApp()}
              disabled={busy}
            >
              <Text style={styles.secondaryLabel}>
                {t("buyerOnboarding.enterApp")}
              </Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => setStep(1)}>
              <Text style={styles.secondaryLabel}>{t("buyerOnboarding.back")}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      <FarmMapPickerModal
        visible={mapOpen}
        onClose={() => setMapOpen(false)}
        initialLat={homeLatitude}
        initialLng={homeLongitude}
        onConfirm={(lat, lng) => {
          setHomeLatitude(lat);
          setHomeLongitude(lng);
          if (!locationLabel.trim()) {
            setLocationLabel(
              t("buyerOnboarding.locationFromMap", {
                lat: lat.toFixed(3),
                lng: lng.toFixed(3)
              })
            );
          }
          setMapOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: buyerColors.canvas },
  skip: { alignSelf: "flex-end" },
  skipText: { color: buyerColors.primary, fontWeight: "600" },
  stepLabel: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  heroTitle: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.xl,
    color: buyerColors.textPrimary
  },
  heroBody: {
    ...mobileTypography.body,
    color: buyerColors.textSecondary,
    lineHeight: 22
  },
  hint: {
    ...mobileTypography.meta,
    color: buyerColors.textMuted,
    marginBottom: mobileSpacing.sm
  },
  input: {
    backgroundColor: buyerColors.canvas,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    padding: mobileSpacing.md,
    ...mobileTypography.body,
    color: buyerColors.textPrimary
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  chip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8,
    borderRadius: buyerRadius.pill,
    borderWidth: 1,
    borderColor: buyerColors.border,
    backgroundColor: buyerColors.cardBg
  },
  chipActive: {
    backgroundColor: buyerColors.primary,
    borderColor: buyerColors.primary
  },
  chipText: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: buyerColors.textSecondary
  },
  chipTextActive: { color: mobileColors.onAccent },
  primary: {
    backgroundColor: buyerColors.primary,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.lg,
    alignItems: "center",
    marginTop: mobileSpacing.md
  },
  primaryLabel: { color: mobileColors.onAccent, fontWeight: "700", fontSize: mobileFontSize.lg },
  secondary: {
    alignItems: "center",
    paddingVertical: mobileSpacing.md
  },
  secondaryLabel: {
    color: buyerColors.primary,
    fontWeight: "600"
  },
  skipField: { marginTop: mobileSpacing.sm },
  skipFieldTx: {
    ...mobileTypography.meta,
    color: buyerColors.textMuted,
    fontWeight: "600"
  },
  skippedNote: {
    ...mobileTypography.meta,
    color: buyerColors.warning,
    marginTop: mobileSpacing.xs
  },
  mapBtn: {
    marginTop: mobileSpacing.sm,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: buyerColors.primary,
    borderStyle: "dashed",
    alignItems: "center"
  },
  mapBtnTx: { color: buyerColors.primary, fontWeight: "700" },
  error: { color: mobileColors.error }
});
