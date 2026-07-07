import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "../../context/SessionContext";
import {
  createMerchantProduct,
  fetchMerchantCategories,
  fetchMerchantMe
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { mobileColors, mobileRadius, mobileSpacing } from "../../theme/mobileTheme";

export function MerchantProductFormScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { accessToken, activeProfileId } = useSession();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [categoryId, setCategoryId] = useState<string | null>(null);
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

  useEffect(() => {
    if (catsQ.data?.[0] && !categoryId) {
      setCategoryId(catsQ.data[0].id);
    }
  }, [catsQ.data, categoryId]);

  const submit = async () => {
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
      await createMerchantProduct(accessToken, activeProfileId, shopId, {
        name: name.trim(),
        categoryId,
        price: p,
        stock: s
      });
      navigation.goBack();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.title}>{t("merchant.product.title")}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t("merchant.onboarding.productName")} />
        <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder={t("merchant.onboarding.productPrice")} />
        <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="number-pad" placeholder={t("merchant.onboarding.productStock")} />
        <View style={styles.catRow}>
          {(catsQ.data ?? []).map((c) => (
            <Pressable key={c.id} style={[styles.chip, categoryId === c.id && styles.chipOn]} onPress={() => setCategoryId(c.id)}>
              <Text>{c.name}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.btn} onPress={() => void submit()} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTx}>{t("merchant.onboarding.createProduct")}</Text>}
        </Pressable>
        {error ? <Text style={styles.err}>{error}</Text> : null}
      </View>
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
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: mobileColors.border },
  chipOn: { borderColor: mobileColors.accent, backgroundColor: "#E8F5EE" },
  btn: { backgroundColor: mobileColors.accent, padding: mobileSpacing.md, borderRadius: mobileRadius.md, alignItems: "center" },
  btnTx: { color: "#fff", fontWeight: "700" },
  err: { color: mobileColors.error }
});
