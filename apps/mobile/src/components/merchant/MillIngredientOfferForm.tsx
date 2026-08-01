import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import {
  createMillIngredientOffer,
  searchMillFeedIngredients,
  type MillFeedIngredientDto,
  type MillIngredientOfferDto,
  type MillIngredientPackaging
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { merchantColors } from "../../theme/merchantTheme";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";
import { FeedIngredientIcon } from "./FeedIngredientIcon";

const PACKAGING: MillIngredientPackaging[] = [
  "kg",
  "sack_50kg",
  "sack_25kg",
  "liter",
  "ton"
];

type Props = {
  onSuccess: (offer: MillIngredientOfferDto) => void | Promise<void>;
  onCancel?: () => void;
};

/**
 * Formulaire création d'offre d'intrant moulin.
 * Passe par createMillIngredientOffer → synchro MerchantProduct existante si public.
 */
export function MillIngredientOfferForm({ onSuccess, onCancel }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId } = useSession();
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

  const searchQry = useQuery({
    queryKey: ["mill-ingredients-search", activeProfileId, searchQ],
    queryFn: () =>
      searchMillFeedIngredients(accessToken!, activeProfileId!, searchQ),
    enabled: Boolean(
      accessToken && activeProfileId && searchQ.trim().length >= 1
    )
  });

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
    onSuccess: async (offer) => {
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ["mill-offers", activeProfileId]
      });
      await queryClient.invalidateQueries({
        queryKey: ["merchant-products", activeProfileId]
      });
      await onSuccess(offer);
    },
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

  return (
    <View style={styles.form} testID="mill-ingredient-offer-form">
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
      {(searchQry.data ?? []).slice(0, 8).map((ing) => {
        const on = selectedIngredient?.id === ing.id;
        return (
          <Pressable
            key={ing.id}
            style={[styles.hitRow, on && styles.hitRowActive]}
            onPress={() => setSelectedIngredient(ing)}
            testID={`mill-ingredient-hit-${ing.id}`}
          >
            <FeedIngredientIcon
              imageUrl={ing.imageUrl}
              iconKey={ing.iconKey}
              category={ing.category}
              canonicalName={ing.canonicalName}
              size={36}
            />
            <Text style={[styles.hitTx, on && styles.hitTxActive]}>
              {ing.canonicalName}
            </Text>
          </Pressable>
        );
      })}
      {selectedIngredient ? (
        <Text style={styles.selected} testID="mill-ingredient-selected">
          {t("merchant.millIngredients.selected", {
            name: selectedIngredient.canonicalName
          })}
        </Text>
      ) : null}

      <Text style={styles.label}>{t("merchant.millIngredients.packaging")}</Text>
      <View style={styles.chipsRow}>
        {PACKAGING.map((p) => (
          <Pressable
            key={p}
            style={[styles.chip, packaging === p && styles.chipActive]}
            onPress={() => setPackaging(p)}
          >
            <Text
              style={[styles.chipTx, packaging === p && styles.chipTxActive]}
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

      <Text style={styles.label}>{t("merchant.millIngredients.stock")}</Text>
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

      {error ? <Text style={styles.err}>{error}</Text> : null}

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

      {onCancel ? (
        <Pressable style={styles.secondaryBtn} onPress={onCancel}>
          <Text style={styles.secondaryBtnTx}>{t("common.cancel")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: mobileSpacing.sm },
  label: {
    fontWeight: "700",
    color: mobileColors.textPrimary,
    fontSize: mobileFontSize.sm,
    marginTop: 4
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    fontSize: mobileFontSize.md,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.background
  },
  hitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  hitRowActive: {
    borderColor: merchantColors.primary,
    backgroundColor: merchantColors.primaryLight
  },
  hitTx: { flex: 1, fontWeight: "600", color: mobileColors.textPrimary },
  hitTxActive: { color: merchantColors.primary },
  selected: {
    fontWeight: "700",
    color: merchantColors.primary,
    fontSize: mobileFontSize.sm
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipActive: {
    borderColor: merchantColors.primary,
    backgroundColor: merchantColors.primaryLight
  },
  chipTx: { fontWeight: "600", color: mobileColors.textPrimary },
  chipTxActive: { color: merchantColors.primary },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8
  },
  switchLabel: { flex: 1, fontWeight: "700", color: mobileColors.textPrimary },
  hint: { fontSize: mobileFontSize.sm, color: mobileColors.textSecondary },
  err: { color: "#B91C1C", fontWeight: "600" },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: merchantColors.primary,
    borderRadius: mobileRadius.md,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryBtnTx: { color: mobileColors.background, fontWeight: "800" },
  secondaryBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingVertical: 12,
    alignItems: "center"
  },
  secondaryBtnTx: { fontWeight: "700", color: mobileColors.textPrimary },
  btnDisabled: { opacity: 0.5 }
});
