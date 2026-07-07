import { useEffect, useMemo, useState } from "react";
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
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
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
import { merchantColors } from "../../theme/merchantTheme";
import { mobileColors, mobileRadius, mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

export function MerchantProductFormScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "MerchantProductForm">>();
  const productId = route.params?.productId;
  const { accessToken, activeProfileId } = useSession();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meQ = useQuery({
    queryKey: ["merchant-me", activeProfileId],
    queryFn: () => fetchMerchantMe(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
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
    if (catsQ.data?.[0] && !categoryId) {
      setCategoryId(catsQ.data[0].id);
    }
  }, [catsQ.data, categoryId]);

  useEffect(() => {
    if (!productId || !productsQ.data) return;
    const existing = productsQ.data.find((p) => p.id === productId);
    if (!existing) return;
    setName(existing.name);
    setPrice(String(existing.price));
    setStock(String(existing.stock));
    setDescription(existing.description ?? "");
    setCategoryId(existing.categoryId);
  }, [productId, productsQ.data]);

  const submit = async (alsoPublish = false) => {
    const shopId = meQ.data?.shops[0]?.id;
    if (!accessToken || !activeProfileId || !shopId || !categoryId || !name.trim()) {
      setError(t("merchant.product.needShop"));
      return;
    }
    const p = Number.parseFloat(price.replace(",", "."));
    const s = Number.parseInt(stock, 10);
    if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(s)) {
      setError(t("merchant.onboarding.invalidProduct"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        categoryId,
        description: appendCategoryDetails(description, selectedCategory, extras),
        price: p,
        stock: s
      };
      let saved;
      if (productId) {
        saved = await updateMerchantProduct(accessToken, activeProfileId, productId, body);
      } else {
        saved = await createMerchantProduct(accessToken, activeProfileId, shopId, body);
      }
      if (alsoPublish && saved.status !== "published") {
        await publishMerchantProduct(accessToken, activeProfileId, saved.id);
      }
      navigation.goBack();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>
          {productId ? t("merchant.product.editTitle") : t("merchant.product.title")}
        </Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t("merchant.onboarding.productName")}
        />
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          placeholder={t("merchant.onboarding.productPrice")}
        />
        <TextInput
          style={styles.input}
          value={stock}
          onChangeText={setStock}
          keyboardType="number-pad"
          placeholder={t("merchant.onboarding.productStock")}
        />
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder={t("merchant.product.descriptionPh")}
          multiline
        />
        <View style={styles.catRow}>
          {(catsQ.data ?? []).map((c) => (
            <Pressable
              key={c.id}
              style={[styles.chip, categoryId === c.id && styles.chipOn]}
              onPress={() => {
                setCategoryId(c.id);
                setExtras({});
              }}
            >
              <Text>{c.name}</Text>
            </Pressable>
          ))}
        </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.background },
  body: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
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
