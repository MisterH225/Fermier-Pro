import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "../../context/SessionContext";
import { createMerchantShop } from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { mobileColors, mobileRadius, mobileSpacing, mobileFontSize } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type CreatedShop = { id: string; name: string };

export function MerchantShopScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId } = useSession();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!accessToken || !activeProfileId || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = (await createMerchantShop(accessToken, activeProfileId, {
        name: name.trim()
      })) as CreatedShop;
      await queryClient.invalidateQueries({ queryKey: ["merchant-me", activeProfileId] });
      await queryClient.invalidateQueries({ queryKey: ["merchant-dashboard", activeProfileId] });
      navigation.replace("MerchantProductForm", { shopId: created.id });
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="merchant-shop-form-screen">
      <View style={styles.body}>
        <Text style={styles.title}>{t("merchant.shop.title")}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t("merchant.onboarding.shopName")}
        />
        <Pressable style={styles.btn} onPress={() => void submit()} disabled={busy}>
          {busy ? <ActivityIndicator color={mobileColors.background} /> : <Text style={styles.btnTx}>{t("merchant.onboarding.createShop")}</Text>}
        </Pressable>
        {error ? <Text style={styles.err}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.background },
  body: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  title: { fontSize: mobileFontSize.xl, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.background
  },
  btn: {
    backgroundColor: mobileColors.accent,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    alignItems: "center"
  },
  btnTx: { color: mobileColors.background, fontWeight: "700" },
  err: { color: mobileColors.error }
});
