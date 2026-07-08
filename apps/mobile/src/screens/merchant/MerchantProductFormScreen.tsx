import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MerchantProductPhotoGrid } from "../../components/merchant/MerchantProductPhotoGrid";
import { useSession } from "../../context/SessionContext";
import {
  createMerchantProduct,
  fetchMerchantCategories,
  fetchMerchantMe,
  fetchMerchantProducts,
  publishMerchantProduct,
  updateMerchantProduct
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import {
  appendCategoryDetails,
  categoryExtraFields
} from "../../lib/merchantCategoryFields";
import { resolveMerchantShopId } from "../../lib/merchantShop";
import { validateMerchantProductFormInput } from "../../lib/merchantProductForm";
import { merchantColors } from "../../theme/merchantTheme";
import { mobileColors, mobileRadius, mobileSpacing } from "../../theme/mobileTheme";
import { useBottomInset } from "../../hooks/useBottomInset";
import type { RootStackParamList } from "../../types/navigation";

export function MerchantProductFormScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "MerchantProductForm">>();
  const productId = route.params?.productId;
  const routeShopId = route.params?.shopId;
  const { accessToken, activeProfileId } = useSession();
  const queryClient = useQueryClient();
  const bottomInset = useBottomInset();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(routeShopId ?? null);
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meQ = useQuery({
    queryKey: ["merchant-me", activeProfileId],
    queryFn: () => fetchMerchantMe(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId),
    staleTime: 0
  });

  const catsQ = useQuery({
    queryKey: ["merchant-categories"],
    queryFn: () => fetchMerchantCategories(accessToken!),
    enabled: Boolean(accessToken)
  });

  const productsQ = useQuery({
    queryKey: ["merchant-products", activeProfileId],
    queryFn: () => fetchMerchantProducts(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId && productId)
  });

  const selectedCategory = useMemo(
    () => (catsQ.data ?? []).find((c) => c.id === categoryId) ?? null,
    [catsQ.data, categoryId]
  );

  const extraFields = useMemo(
    () => categoryExtraFields(selectedCategory),
    [selectedCategory]
  );

  useEffect(() => {
    if (routeShopId) {
      setSelectedShopId(routeShopId);
    }
  }, [routeShopId]);

  useFocusEffect(
    useCallback(() => {
      void meQ.refetch();
      void catsQ.refetch();
    }, [meQ, catsQ])
  );

  const shopId = useMemo(
    () => resolveMerchantShopId(meQ.data, selectedShopId ?? routeShopId),
    [meQ.data, selectedShopId, routeShopId]
  );

  const shops = meQ.data?.shops ?? [];

  useEffect(() => {
    if (catsQ.data?.[0] && !categoryId) {
      setCategoryId(catsQ.data[0].id);
    }
  }, [catsQ.data, categoryId]);

  useEffect(() => {
    if (shopId && !selectedShopId) {
      setSelectedShopId(shopId);
    }
  }, [shopId, selectedShopId]);

  useEffect(() => {
    if (!productId || !productsQ.data) return;
    const existing = productsQ.data.find((p) => p.id === productId);
    if (!existing) return;
    setName(existing.name);
    setPrice(String(existing.price));
    setStock(String(existing.stock));
    setDescription(existing.description ?? "");
    setCategoryId(existing.categoryId);
    setPhotoUrls(existing.photoUrls ?? []);
    if (existing.shopId) {
      setSelectedShopId(existing.shopId);
    }
  }, [productId, productsQ.data]);

  const submit = async (alsoPublish = false) => {
    const resolvedShopId = resolveMerchantShopId(meQ.data, selectedShopId ?? routeShopId);
    if (!accessToken || !activeProfileId || !resolvedShopId) {
      setError(t("merchant.product.needShop"));
      return;
    }
    const validation = validateMerchantProductFormInput({
      name,
      price,
      stock,
      categoryId
    });
    if (!validation.ok) {
      setError(t(validation.errorKey));
      return;
    }
    const p = validation.price;
    const s = validation.stock;
    const resolvedCategoryId = categoryId!;
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        categoryId: resolvedCategoryId,
        description: appendCategoryDetails(description, selectedCategory, extras),
        price: p,
        stock: s,
        photoUrls
      };
      let saved;
      if (productId) {
        saved = await updateMerchantProduct(accessToken, activeProfileId, productId, body);
      } else {
        saved = await createMerchantProduct(accessToken, activeProfileId, resolvedShopId, body);
      }
      if (alsoPublish && saved.status !== "published") {
        await publishMerchantProduct(accessToken, activeProfileId, saved.id);
      }
      await queryClient.invalidateQueries({ queryKey: ["merchant-products", activeProfileId] });
      await queryClient.invalidateQueries({ queryKey: ["merchant-me", activeProfileId] });
      await queryClient.invalidateQueries({ queryKey: ["merchant-dashboard", activeProfileId] });
      navigation.goBack();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!shopId && !productId) {
    if (meQ.isLoading && !routeShopId) {
      return (
        <SafeAreaView style={styles.safe} testID="merchant-product-form-loading">
          <ActivityIndicator style={{ marginTop: 40 }} color={merchantColors.primary} />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.safe} testID="merchant-product-form-no-shop">
        <View style={[styles.emptyShop, { paddingBottom: bottomInset }]}>
          <Text style={styles.title}>{t("merchant.product.needShop")}</Text>
          <Pressable
            style={styles.btn}
            onPress={() => navigation.navigate("MerchantShops")}
          >
            <Text style={styles.btnTx}>{t("merchant.onboarding.createShop")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="merchant-product-form-screen">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: bottomInset }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>
          {productId ? t("merchant.product.editTitle") : t("merchant.product.title")}
        </Text>
        {shops.length > 1 && !productId ? (
          <View style={styles.shopPicker}>
            <Text style={styles.shopPickerLabel}>{t("merchant.product.selectShop")}</Text>
            <View style={styles.catRow}>
              {shops.map((shop) => (
                <Pressable
                  key={shop.id}
                  style={[styles.chip, selectedShopId === shop.id && styles.chipOn]}
                  onPress={() => setSelectedShopId(shop.id)}
                >
                  <Text>{shop.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <MerchantProductPhotoGrid
          shopId={shopId}
          productId={productId}
          photoUrls={photoUrls}
          onChange={setPhotoUrls}
        />
        <FormField label={t("merchant.onboarding.productName")} required>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("merchant.product.placeholders.name")}
          />
        </FormField>
        <FormField label={t("merchant.onboarding.productPrice")} required>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder={t("merchant.product.placeholders.price")}
          />
        </FormField>
        <FormField
          label={t("merchant.product.stockLabel")}
          hint={t("merchant.product.stockHint")}
          required
        >
          <TextInput
            style={styles.input}
            value={stock}
            onChangeText={setStock}
            keyboardType="number-pad"
            placeholder={t("merchant.onboarding.productStock")}
            testID="merchant-product-form-stock"
          />
        </FormField>
        <FormField label={t("merchant.product.descriptionPh")}>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder={t("merchant.product.placeholders.description")}
            multiline
          />
        </FormField>
        <FormField label={t("merchant.product.categoryLabel")} required>
          {catsQ.isLoading ? (
            <ActivityIndicator color={merchantColors.primary} />
          ) : (catsQ.data ?? []).length === 0 ? (
            <Text style={styles.warn}>{t("merchant.product.errors.noCategories")}</Text>
          ) : (
            <View style={styles.catRow}>
              {(catsQ.data ?? []).map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.chip, categoryId === c.id && styles.chipOn]}
                  onPress={() => {
                    setCategoryId(c.id);
                    setExtras({});
                  }}
                  testID={`merchant-product-category-${c.slug}`}
                >
                  <Text>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </FormField>
        {extraFields.map((field) => (
          <TextInput
            key={field.key}
            style={[styles.input, field.multiline && styles.multiline]}
            value={extras[field.key] ?? ""}
            onChangeText={(v) => setExtras((prev) => ({ ...prev, [field.key]: v }))}
            placeholder={field.placeholderKey ? t(field.placeholderKey) : t(field.labelKey)}
            multiline={field.multiline}
          />
        ))}
        <Pressable style={styles.btn} onPress={() => void submit(false)} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnTx}>
              {productId ? t("merchant.product.save") : t("merchant.onboarding.createProduct")}
            </Text>
          )}
        </Pressable>
        <Pressable style={styles.btnSecondary} onPress={() => void submit(true)} disabled={busy}>
          <Text style={styles.btnTx}>{t("merchant.product.saveAndPublish")}</Text>
        </Pressable>
        {error ? <Text style={styles.err}>{error}</Text> : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({
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
  emptyShop: {
    flex: 1,
    justifyContent: "center",
    padding: mobileSpacing.lg,
    gap: mobileSpacing.lg
  },
  body: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  field: { gap: mobileSpacing.xs },
  fieldLabel: { fontSize: 14, fontWeight: "700", color: merchantColors.textPrimary },
  fieldHint: { fontSize: 12, color: merchantColors.textSecondary, marginBottom: 2 },
  required: { color: merchantColors.danger },
  warn: { color: merchantColors.warning, fontSize: 13 },
  title: { fontSize: 20, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    backgroundColor: "#fff"
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  chipOn: { borderColor: merchantColors.primary, backgroundColor: merchantColors.primaryLight },
  shopPicker: { gap: mobileSpacing.xs },
  shopPickerLabel: { fontWeight: "600", color: merchantColors.textSecondary, fontSize: 13 },
  btn: {
    backgroundColor: merchantColors.primary,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    alignItems: "center"
  },
  btnSecondary: {
    backgroundColor: merchantColors.success,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    alignItems: "center"
  },
  btnTx: { color: "#fff", fontWeight: "700" },
  err: { color: mobileColors.error }
});
