import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MerchantProductPhotoGrid } from "../../../components/merchant/MerchantProductPhotoGrid";
import { useSession } from "../../../context/SessionContext";
import {
  chooseMerchantSubscription,
  createMerchantProduct,
  createMerchantShop,
  fetchMerchantCategories,
  fetchMerchantMe,
  patchMerchantOnboarding,
  publishMerchantProduct,
  type MerchantCategoryDto,
  type MerchantMeDto
} from "../../../lib/api";
import { formatApiError } from "../../../lib/apiErrors";
import { resolveMerchantOnboardingStep } from "../../../lib/merchantOnboardingState";
import { validateMerchantProductFormInput } from "../../../lib/merchantProductForm";
import { MerchantSubscriptionScreen } from "../../merchant/MerchantSubscriptionScreen";
import { merchantColors } from "../../../theme/merchantTheme";
import { mobileColors, mobileRadius, mobileSpacing } from "../../../theme/mobileTheme";
import type { ReactNode } from "react";

type Props = {
  onFinished: () => void;
  onCancel: () => void;
};

export function MerchantOnboardingScreen({ onFinished, onCancel }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId, refreshAuthMe } = useSession();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<MerchantMeDto | null>(null);
  const [categories, setCategories] = useState<MerchantCategoryDto[]>([]);

  const [shopName, setShopName] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productStock, setProductStock] = useState("1");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [productPhotoUrls, setProductPhotoUrls] = useState<string[]>([]);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);

  const loadMe = async () => {
    if (!accessToken || !activeProfileId) return;
    const data = await fetchMerchantMe(accessToken, activeProfileId);
    setMe(data);
    return data;
  };

  const skipStep = async (flags: {
    shopSkipped?: boolean;
    productSkipped?: boolean;
  }) => {
    if (!accessToken || !activeProfileId) return;
    setBusy(true);
    setError(null);
    try {
      await patchMerchantOnboarding(accessToken, activeProfileId, {
        ...flags,
        onboardingComplete: true
      });
      await refreshAuthMe();
      onFinished();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const invalidateMerchantCache = async () => {
    if (!activeProfileId) return;
    await queryClient.invalidateQueries({ queryKey: ["merchant-me", activeProfileId] });
    await queryClient.invalidateQueries({ queryKey: ["merchant-dashboard", activeProfileId] });
  };

  const resumeFromServer = async (data: MerchantMeDto) => {
    const next = resolveMerchantOnboardingStep(data);
    if (next === "finished") {
      await refreshAuthMe();
      onFinished();
      return;
    }
    setStep(next);
    if (next === 2) {
      await ensureCategories();
    }
  };

  useEffect(() => {
    void (async () => {
      const data = await loadMe();
      if (!data) return;
      await resumeFromServer(data);
    })();
  }, [accessToken, activeProfileId]);

  const onCreateShop = async () => {
    if (!accessToken || !activeProfileId || !shopName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createMerchantShop(accessToken, activeProfileId, {
        name: shopName.trim()
      });
      const data = await loadMe();
      await invalidateMerchantCache();
      await refreshAuthMe();
      if (data) {
        await resumeFromServer(data);
      }
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onCreateProduct = async () => {
    if (!accessToken || !activeProfileId || !me?.shops[0]) return;
    const validation = validateMerchantProductFormInput({
      name: productName,
      price: productPrice,
      stock: productStock,
      categoryId
    });
    if (!validation.ok) {
      setError(t(validation.errorKey));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createMerchantProduct(
        accessToken,
        activeProfileId,
        me.shops[0].id,
        {
          name: productName.trim(),
          categoryId: categoryId!,
          price: validation.price,
          stock: validation.stock,
          photoUrls: productPhotoUrls
        }
      );
      setPendingProductId(created.id);
      setStep(3);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onPublish = async () => {
    if (!accessToken || !activeProfileId || !pendingProductId) return;
    if (!me?.subscriptionTier) {
      setStep(3);
      return;
    }
    setBusy(true);
    try {
      await publishMerchantProduct(accessToken, activeProfileId, pendingProductId);
      await patchMerchantOnboarding(accessToken, activeProfileId, {
        onboardingComplete: true
      });
      await refreshAuthMe();
      onFinished();
    } catch (e: unknown) {
      const err = e as { body?: { code?: string } };
      if (err?.body?.code === "SUBSCRIPTION_REQUIRED") {
        setStep(3);
      } else {
        setError(formatApiError(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const ensureCategories = async () => {
    if (!accessToken || categories.length) return;
    const rows = await fetchMerchantCategories(accessToken);
    setCategories(rows);
    if (rows[0]) setCategoryId(rows[0].id);
  };

  if (step === 0) {
    return (
      <MerchantSubscriptionScreen
        autoAdvanceIfTierChosen
        skippable
        onSkip={async () => {
          if (accessToken && activeProfileId && !me?.subscriptionTier) {
            setBusy(true);
            setError(null);
            try {
              await chooseMerchantSubscription(accessToken, activeProfileId, {
                tier: "free"
              });
              await loadMe();
            } catch (e) {
              setError(formatApiError(e));
              setBusy(false);
              return;
            }
            setBusy(false);
          }
          setStep(1);
        }}
        onChosen={async () => {
          await loadMe();
          setStep(1);
        }}
        onCancel={onCancel}
      />
    );
  }

  if (step === 3) {
    return (
      <MerchantSubscriptionScreen
        autoAdvanceIfTierChosen
        skippable={false}
        onChosen={async () => {
          await loadMe();
          if (pendingProductId) {
            await onPublish();
          } else {
            await patchMerchantOnboarding(accessToken!, activeProfileId!, {
              onboardingComplete: true
            });
            await refreshAuthMe();
            onFinished();
          }
        }}
        onCancel={onCancel}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>
          {step === 1
            ? t("merchant.onboarding.shopTitle")
            : t("merchant.onboarding.productTitle")}
        </Text>

        {step === 1 && (me?.shopCount ?? 0) === 0 ? (
          <>
            <TextInput
              style={styles.input}
              value={shopName}
              onChangeText={setShopName}
              placeholder={t("merchant.onboarding.shopName")}
            />
            <Pressable style={styles.primary} onPress={() => void onCreateShop()} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTx}>{t("merchant.onboarding.createShop")}</Text>}
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => void skipStep({ shopSkipped: true })} disabled={busy}>
              <Text style={styles.secondaryTx}>{t("merchant.onboarding.skip")}</Text>
            </Pressable>
          </>
        ) : null}

        {step === 2 && (me?.shopCount ?? 0) > 0 ? (
          <>
            <MerchantProductPhotoGrid
              shopId={me?.shops[0]?.id ?? null}
              photoUrls={productPhotoUrls}
              onChange={setProductPhotoUrls}
            />
            <OnboardingField label={t("merchant.onboarding.productName")} required>
              <TextInput
                style={styles.input}
                value={productName}
                onChangeText={setProductName}
                placeholder={t("merchant.product.placeholders.name")}
                testID="merchant-onboarding-product-name"
              />
            </OnboardingField>
            <OnboardingField label={t("merchant.onboarding.productPrice")} required>
              <TextInput
                style={styles.input}
                value={productPrice}
                onChangeText={setProductPrice}
                keyboardType="decimal-pad"
                placeholder={t("merchant.product.placeholders.price")}
                testID="merchant-onboarding-product-price"
              />
            </OnboardingField>
            <OnboardingField
              label={t("merchant.product.stockLabel")}
              hint={t("merchant.product.stockHint")}
              required
            >
              <TextInput
                style={styles.input}
                value={productStock}
                onChangeText={setProductStock}
                keyboardType="number-pad"
                placeholder={t("merchant.onboarding.productStock")}
                testID="merchant-onboarding-product-stock"
              />
            </OnboardingField>
            <OnboardingField label={t("merchant.product.categoryLabel")} required>
              {categories.length === 0 ? (
                <Pressable onPress={() => void ensureCategories()} style={styles.hint}>
                  <Text>{t("merchant.onboarding.loadCategories")}</Text>
                </Pressable>
              ) : (
                <View style={styles.catRow}>
                  {categories.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[styles.catChip, categoryId === c.id && styles.catChipOn]}
                      onPress={() => setCategoryId(c.id)}
                      testID={`merchant-onboarding-category-${c.slug}`}
                    >
                      <Text>{c.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </OnboardingField>
            <Pressable
              style={styles.primary}
              onPress={() => void onCreateProduct()}
              disabled={busy}
              testID="merchant-onboarding-create-product"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryTx}>{t("merchant.onboarding.createProduct")}</Text>
              )}
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => void skipStep({ productSkipped: true })} disabled={busy}>
              <Text style={styles.secondaryTx}>{t("merchant.onboarding.skip")}</Text>
            </Pressable>
            {pendingProductId ? (
              <Pressable style={styles.primary} onPress={() => void onPublish()} disabled={busy}>
                <Text style={styles.primaryTx}>{t("merchant.onboarding.publish")}</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {error ? <Text style={styles.err}>{error}</Text> : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OnboardingField({
  label,
  hint,
  required = false,
  children
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.background },
  flex: { flex: 1 },
  scroll: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  title: { fontSize: 22, fontWeight: "700", color: mobileColors.textPrimary },
  field: { gap: mobileSpacing.xs },
  fieldLabel: { fontSize: 14, fontWeight: "700", color: merchantColors.textPrimary },
  fieldHint: { fontSize: 12, color: merchantColors.textSecondary, marginBottom: 2 },
  required: { color: merchantColors.danger },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    backgroundColor: "#fff"
  },
  primary: {
    backgroundColor: mobileColors.accent,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    alignItems: "center"
  },
  primaryTx: { color: "#fff", fontWeight: "700" },
  secondary: { padding: mobileSpacing.md, alignItems: "center" },
  secondaryTx: { color: mobileColors.accent, fontWeight: "600" },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  catChipOn: { borderColor: mobileColors.accent, backgroundColor: "#E8F5EE" },
  hint: { paddingVertical: 8 },
  err: { color: mobileColors.error }
});
