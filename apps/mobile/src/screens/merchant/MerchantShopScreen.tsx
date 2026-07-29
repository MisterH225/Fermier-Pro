import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useModal } from "../../components/modals/useModal";
import { useSession } from "../../context/SessionContext";
import {
  createMerchantShop,
  fetchMerchantMe,
  isSubscriptionLimitError
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";
import { mobileColors, mobileSpacing, mobileFontSize } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type CreatedShop = { id: string; name: string };

export function MerchantShopScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { open } = useModal();
  const { accessToken, activeProfileId } = useSession();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meQ = useQuery({
    queryKey: ["merchant-me", activeProfileId],
    queryFn: () => fetchMerchantMe(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

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
      if (isSubscriptionLimitError(e) && e.code === "SHOP_LIMIT_REACHED") {
        open("upgrade-limit", {
          code: e.code,
          limit: meQ.data?.maxShops ?? meQ.data?.standardMaxShops ?? null,
          onUpgrade: () => navigation.navigate("MerchantSubscription")
        });
        return;
      }
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
    borderRadius: merchantRadius.button,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.background
  },
  btn: {
    backgroundColor: merchantColors.primary,
    padding: mobileSpacing.md,
    borderRadius: merchantRadius.button,
    alignItems: "center"
  },
  btnTx: { color: merchantColors.onPrimary, fontWeight: "700" },
  err: { color: mobileColors.error }
});
