import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { MerchantMobileShell } from "../../components/layout/MerchantMobileShell";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import {
  createMillIngredientOffer,
  deactivateMillIngredientOffer,
  fetchMerchantMe,
  fetchMillIngredientOffers,
  searchMillFeedIngredients,
  updateMillIngredientOffer,
  type MillFeedIngredientDto,
  type MillIngredientOfferDto,
  type MillIngredientPackaging
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { canAccessMillFeatures } from "../../lib/merchantKind";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

const PACKAGING: MillIngredientPackaging[] = [
  "kg",
  "sack_50kg",
  "sack_25kg",
  "liter",
  "ton"
];

export function MillIngredientsScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId, platformModules } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [selectedIngredient, setSelectedIngredient] =
    useState<MillFeedIngredientDto | null>(null);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [mixingCost, setMixingCost] = useState("");
  const [packaging, setPackaging] =
    useState<MillIngredientPackaging>("sack_50kg");
  const [isPublic, setIsPublic] = useState(false);

  const meQ = useQuery({
    queryKey: ["merchant-me", activeProfileId],
    queryFn: () => fetchMerchantMe(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const millOk = canAccessMillFeatures(
    platformModules,
    meQ.data?.merchantKind
  );

  const offersQ = useQuery({
    queryKey: ["mill-offers", activeProfileId],
    queryFn: () => fetchMillIngredientOffers(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId && millOk)
  });

  const searchQry = useQuery({
    queryKey: ["mill-ingredients-search", activeProfileId, searchQ],
    queryFn: () =>
      searchMillFeedIngredients(accessToken!, activeProfileId!, searchQ),
    enabled: Boolean(
      accessToken && activeProfileId && millOk && showForm && searchQ.trim().length >= 1
    )
  });

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["mill-offers", activeProfileId]
    });
  }, [queryClient, activeProfileId]);

  useFocusEffect(
    useCallback(() => {
      void offersQ.refetch();
    }, [offersQ])
  );

  const createMut = useMutation({
    mutationFn: () =>
      createMillIngredientOffer(accessToken!, activeProfileId!, {
        feedIngredientId: selectedIngredient!.id,
        pricePerUnit: Number(price),
        packaging,
        stockQuantity: Number(stock),
        mixingCostPerKg: mixingCost.trim() ? Number(mixingCost) : null,
        isPubliclyListed: isPublic
      }),
    onSuccess: async () => {
      setShowForm(false);
      setSelectedIngredient(null);
      setSearchQ("");
      setPrice("");
      setStock("");
      setMixingCost("");
      setIsPublic(false);
      setError(null);
      await invalidate();
    },
    onError: (e) => setError(formatApiError(e))
  });

  const togglePublicMut = useMutation({
    mutationFn: (offer: MillIngredientOfferDto) =>
      updateMillIngredientOffer(accessToken!, activeProfileId!, offer.id, {
        isPubliclyListed: !offer.isPubliclyListed
      }),
    onSuccess: () => void invalidate(),
    onError: (e) => setError(formatApiError(e))
  });

  const deactivateMut = useMutation({
    mutationFn: (offerId: string) =>
      deactivateMillIngredientOffer(accessToken!, activeProfileId!, offerId),
    onSuccess: () => void invalidate(),
    onError: (e) => setError(formatApiError(e))
  });

  const canSubmit = useMemo(() => {
    return (
      Boolean(selectedIngredient) &&
      Number(price) >= 0 &&
      price.trim() !== "" &&
      Number(stock) >= 0 &&
      stock.trim() !== ""
    );
  }, [selectedIngredient, price, stock]);

  if (meQ.isLoading) {
    return (
      <MerchantMobileShell omitBottomTabBar>
        <ActivityIndicator color={merchantColors.primary} style={{ marginTop: 40 }} />
      </MerchantMobileShell>
    );
  }

  if (!millOk) {
    return (
      <MerchantMobileShell omitBottomTabBar>
        <View style={styles.pad}>
          <Text style={styles.title}>{t("merchant.millIngredients.title")}</Text>
          <Text style={styles.hint}>{t("merchant.millIngredients.unavailable")}</Text>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate("MerchantDashboard")}
          >
            <Text style={styles.secondaryBtnTx}>{t("common.close")}</Text>
          </Pressable>
        </View>
      </MerchantMobileShell>
    );
  }

  return (
    <MerchantMobileShell omitBottomTabBar>
      <FlatList
        testID="mill-ingredients-list"
        data={offersQ.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.pad,
          { paddingBottom: bottomInset + mobileSpacing.xl }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void offersQ.refetch().finally(() => setRefreshing(false));
            }}
            tintColor={merchantColors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.title}>{t("merchant.millIngredients.title")}</Text>
            <Text style={styles.hint}>{t("merchant.millIngredients.subtitle")}</Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => setShowForm((v) => !v)}
              testID="mill-ingredients-toggle-form"
            >
              <Text style={styles.primaryBtnTx}>
                {showForm
                  ? t("merchant.millIngredients.cancelForm")
                  : t("merchant.millIngredients.addOffer")}
              </Text>
            </Pressable>

            {showForm ? (
              <View style={styles.form} testID="mill-ingredients-form">
                <Text style={styles.label}>
                  {t("merchant.millIngredients.searchIngredient")}
                </Text>
                <TextInput
                  style={styles.input}
                  value={searchQ}
                  onChangeText={setSearchQ}
                  placeholder={t("merchant.millIngredients.searchPlaceholder")}
                  testID="mill-ingredients-search"
                />
                {(searchQry.data ?? []).slice(0, 8).map((ing) => (
                  <Pressable
                    key={ing.id}
                    style={[
                      styles.chip,
                      selectedIngredient?.id === ing.id && styles.chipActive
                    ]}
                    onPress={() => setSelectedIngredient(ing)}
                  >
                    <Text
                      style={[
                        styles.chipTx,
                        selectedIngredient?.id === ing.id && styles.chipTxActive
                      ]}
                    >
                      {ing.canonicalName}
                    </Text>
                  </Pressable>
                ))}
                {selectedIngredient ? (
                  <Text style={styles.selected}>
                    {t("merchant.millIngredients.selected", {
                      name: selectedIngredient.canonicalName
                    })}
                  </Text>
                ) : null}

                <Text style={styles.label}>
                  {t("merchant.millIngredients.packaging")}
                </Text>
                <View style={styles.chipsRow}>
                  {PACKAGING.map((p) => (
                    <Pressable
                      key={p}
                      style={[styles.chip, packaging === p && styles.chipActive]}
                      onPress={() => setPackaging(p)}
                    >
                      <Text
                        style={[
                          styles.chipTx,
                          packaging === p && styles.chipTxActive
                        ]}
                      >
                        {t(`merchant.millIngredients.packagingLabels.${p}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>
                  {t("merchant.millIngredients.pricePerUnit")}
                </Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  testID="mill-ingredients-price"
                />

                <Text style={styles.label}>
                  {t("merchant.millIngredients.stock")}
                </Text>
                <TextInput
                  style={styles.input}
                  value={stock}
                  onChangeText={setStock}
                  keyboardType="decimal-pad"
                  testID="mill-ingredients-stock"
                />

                <Text style={styles.label}>
                  {t("merchant.millIngredients.mixingCost")}
                </Text>
                <TextInput
                  style={styles.input}
                  value={mixingCost}
                  onChangeText={setMixingCost}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>
                    {t("merchant.millIngredients.sellWholesale")}
                  </Text>
                  <Switch
                    value={isPublic}
                    onValueChange={setIsPublic}
                    testID="mill-ingredients-public"
                  />
                </View>
                <Text style={styles.hint}>
                  {t("merchant.millIngredients.sellWholesaleHint")}
                </Text>

                <Pressable
                  style={[styles.primaryBtn, !canSubmit && styles.btnDisabled]}
                  disabled={!canSubmit || createMut.isPending}
                  onPress={() => createMut.mutate()}
                  testID="mill-ingredients-submit"
                >
                  {createMut.isPending ? (
                    <ActivityIndicator color={mobileColors.background} />
                  ) : (
                    <Text style={styles.primaryBtnTx}>
                      {t("merchant.millIngredients.save")}
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {error ? <Text style={styles.err}>{error}</Text> : null}
            <Text style={styles.sectionTitle}>
              {t("merchant.millIngredients.myOffers")}
            </Text>
          </View>
        }
        ListEmptyComponent={
          offersQ.isLoading ? (
            <ActivityIndicator color={merchantColors.primary} />
          ) : (
            <Text style={styles.hint}>{t("merchant.millIngredients.empty")}</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card} testID={`mill-offer-${item.id}`}>
            <Text style={styles.cardTitle}>
              {item.feedIngredientName ?? item.feedIngredientId}
            </Text>
            <Text style={styles.cardMeta}>
              {t(`merchant.millIngredients.packagingLabels.${item.packaging}`)}{" "}
              · {item.pricePerUnit.toLocaleString("fr-FR")} XOF
              {item.pricePerKg != null
                ? ` (${Math.round(item.pricePerKg).toLocaleString("fr-FR")} / kg)`
                : ""}
            </Text>
            <Text style={styles.cardMeta}>
              {t("merchant.millIngredients.stockLabel", {
                qty: item.stockQuantity
              })}
              {item.isPubliclyListed
                ? ` · ${t("merchant.millIngredients.publicBadge")}`
                : ` · ${t("merchant.millIngredients.privateBadge")}`}
            </Text>
            <View style={styles.cardActions}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => togglePublicMut.mutate(item)}
              >
                <Text style={styles.secondaryBtnTx}>
                  {item.isPubliclyListed
                    ? t("merchant.millIngredients.unlist")
                    : t("merchant.millIngredients.listPublic")}
                </Text>
              </Pressable>
              <Pressable
                style={styles.dangerBtn}
                onPress={() => deactivateMut.mutate(item.id)}
              >
                <Text style={styles.dangerBtnTx}>
                  {t("merchant.millIngredients.deactivate")}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </MerchantMobileShell>
  );
}

const styles = StyleSheet.create({
  pad: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  headerBlock: { gap: mobileSpacing.md, marginBottom: mobileSpacing.md },
  title: {
    fontSize: mobileFontSize.xl,
    fontWeight: "700",
    color: merchantColors.textPrimary
  },
  hint: {
    fontSize: mobileFontSize.sm,
    color: merchantColors.textSecondary
  },
  sectionTitle: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: merchantColors.textPrimary,
    marginTop: mobileSpacing.sm
  },
  form: {
    gap: mobileSpacing.sm,
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: merchantColors.border
  },
  label: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600",
    color: merchantColors.textSecondary
  },
  input: {
    borderWidth: 1,
    borderColor: merchantColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    color: merchantColors.textPrimary
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: merchantColors.border,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md
  },
  chipActive: {
    borderColor: merchantColors.primary,
    backgroundColor: merchantColors.primary
  },
  chipTx: { color: merchantColors.textPrimary, fontWeight: "600", fontSize: mobileFontSize.sm },
  chipTxActive: { color: merchantColors.onPrimary },
  selected: { color: merchantColors.primary, fontWeight: "600" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.md
  },
  switchLabel: {
    flex: 1,
    fontWeight: "600",
    color: merchantColors.textPrimary
  },
  primaryBtn: {
    backgroundColor: merchantColors.primary,
    padding: mobileSpacing.md,
    borderRadius: merchantRadius.button,
    alignItems: "center"
  },
  primaryBtnTx: { color: merchantColors.onPrimary, fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },
  secondaryBtn: {
    padding: mobileSpacing.sm,
    alignItems: "center"
  },
  secondaryBtnTx: { color: merchantColors.primary, fontWeight: "600" },
  dangerBtn: { padding: mobileSpacing.sm },
  dangerBtnTx: { color: merchantColors.danger, fontWeight: "600" },
  card: {
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: merchantColors.border,
    gap: 4
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: mobileFontSize.md,
    color: merchantColors.textPrimary
  },
  cardMeta: { color: merchantColors.textSecondary, fontSize: mobileFontSize.sm },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: mobileSpacing.sm
  },
  err: { color: mobileColors.error }
});
