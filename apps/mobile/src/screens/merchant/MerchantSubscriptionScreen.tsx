import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../context/SessionContext";
import {
  chooseMerchantSubscription,
  fetchMerchantMe,
  type MerchantMeDto
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { mobileColors, mobileRadius, mobileSpacing } from "../../theme/mobileTheme";

type Props = {
  skippable?: boolean;
  onSkip?: () => void;
  onChosen: () => void | Promise<void>;
  onCancel: () => void;
};

export function MerchantSubscriptionScreen({
  skippable = false,
  onSkip,
  onChosen,
  onCancel
}: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<MerchantMeDto | null>(null);

  const load = async () => {
    if (!accessToken || !activeProfileId) return;
    const data = await fetchMerchantMe(accessToken, activeProfileId);
    setMe(data);
  };

  const choose = async (tier: "free" | "premium") => {
    if (!accessToken || !activeProfileId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await chooseMerchantSubscription(accessToken, activeProfileId, {
        tier,
        paymentMethod: tier === "premium" ? "wallet" : undefined
      });
      if ("pending" in res && res.pending) {
        setError(t("merchant.subscription.premiumPending"));
        return;
      }
      await onChosen();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("merchant.subscription.title")}</Text>
        <Text style={styles.sub}>{t("merchant.subscription.subtitle")}</Text>

        <View style={styles.row}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("merchant.subscription.freeTitle")}</Text>
            <Text style={styles.bullet}>• {t("merchant.subscription.freeShop")}</Text>
            <Text style={styles.bullet}>• {t("merchant.subscription.freeProducts")}</Text>
            <Pressable
              style={styles.btn}
              disabled={busy}
              onPress={() => void choose("free")}
            >
              <Text style={styles.btnTx}>{t("merchant.subscription.chooseFree")}</Text>
            </Pressable>
          </View>

          <View style={[styles.card, styles.cardPremium]}>
            <Text style={styles.cardTitle}>{t("merchant.subscription.premiumTitle")}</Text>
            <Text style={styles.bullet}>• {t("merchant.subscription.premiumProducts")}</Text>
            <Text style={styles.bullet}>
              • {t("merchant.subscription.premiumShops", {
                count: me?.premiumMaxShops ?? 3
              })}
            </Text>
            <Text style={styles.price}>
              {t("merchant.subscription.premiumPrice", {
                price: (me?.premiumPriceXof ?? 5000).toLocaleString("fr-FR")
              })}
            </Text>
            <Pressable
              style={[styles.btn, styles.btnPremium]}
              disabled={busy}
              onPress={() => {
                void load();
                void choose("premium");
              }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnTx}>{t("merchant.subscription.choosePremium")}</Text>
              )}
            </Pressable>
          </View>
        </View>

        {skippable && onSkip ? (
          <Pressable style={styles.skip} onPress={onSkip} disabled={busy}>
            <Text style={styles.skipTx}>{t("merchant.onboarding.skip")}</Text>
          </Pressable>
        ) : null}

        <Pressable style={styles.cancel} onPress={onCancel}>
          <Text style={styles.cancelTx}>{t("common.cancel")}</Text>
        </Pressable>

        {error ? <Text style={styles.err}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.background },
  scroll: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  title: { fontSize: 24, fontWeight: "800", color: mobileColors.textPrimary },
  sub: { color: mobileColors.textSecondary },
  row: { flexDirection: "row", gap: mobileSpacing.md },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    backgroundColor: "#fff"
  },
  cardPremium: { borderColor: "#D97706", backgroundColor: "#FFFBEB" },
  cardTitle: { fontWeight: "800", fontSize: 18, marginBottom: 8 },
  bullet: { marginBottom: 4, color: mobileColors.textPrimary },
  price: { fontWeight: "700", marginVertical: 8, color: "#B45309" },
  btn: {
    marginTop: 12,
    backgroundColor: mobileColors.accent,
    padding: 12,
    borderRadius: mobileRadius.md,
    alignItems: "center"
  },
  btnPremium: { backgroundColor: "#D97706" },
  btnTx: { color: "#fff", fontWeight: "700" },
  skip: { alignItems: "center", padding: 12 },
  skipTx: { color: mobileColors.accent, fontWeight: "600" },
  cancel: { alignItems: "center" },
  cancelTx: { color: mobileColors.textSecondary },
  err: { color: mobileColors.error }
});
