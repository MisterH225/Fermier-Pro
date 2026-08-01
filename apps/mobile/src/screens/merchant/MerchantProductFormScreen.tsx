import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { MerchantMobileShell } from "../../components/layout/MerchantMobileShell";
import { MerchantProductForm } from "../../components/merchant/MerchantProductForm";
import { MillIngredientOfferForm } from "../../components/merchant/MillIngredientOfferForm";
import { useSession } from "../../context/SessionContext";
import { useScrollBottomPad } from "../../hooks/useScrollBottomPad";
import { fetchMerchantMe } from "../../lib/api";
import { canAccessMillFeatures } from "../../lib/merchantKind";
import { merchantColors } from "../../theme/merchantTheme";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type CreateKind = "product" | "ingredient";

/**
 * Écran unifié « Nouveau produit ».
 * Moulin : sélecteur Intrant / Autre produit en tête.
 * Commerçant standard : formulaire produit inchangé (pas de sélecteur).
 */
export function MerchantProductFormScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "MerchantProductForm">>();
  const { accessToken, activeProfileId, platformModules } = useSession();
  const scrollPad = useScrollBottomPad();

  const meQ = useQuery({
    queryKey: ["merchant-me", activeProfileId],
    queryFn: () => fetchMerchantMe(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const isMill = canAccessMillFeatures(
    platformModules,
    meQ.data?.merchantKind
  );
  const editing = Boolean(route.params?.productId);
  const initialKind: CreateKind =
    route.params?.createKind === "ingredient" ? "ingredient" : "product";
  const [kind, setKind] = useState<CreateKind>(initialKind);

  useEffect(() => {
    setKind(initialKind);
  }, [initialKind]);

  if (meQ.isLoading && !meQ.data) {
    return (
      <MerchantMobileShell omitBottomTabBar>
        <ActivityIndicator
          color={merchantColors.primary}
          style={{ marginTop: 40 }}
        />
      </MerchantMobileShell>
    );
  }

  // Édition produit existant → toujours le formulaire produit.
  if (editing || !isMill || kind === "product") {
    return (
      <View style={styles.flex} testID="merchant-product-form-screen">
        {isMill && !editing ? (
          <View style={styles.selectorWrap} testID="mill-create-kind-selector">
            <KindSelector kind={kind} onChange={setKind} />
          </View>
        ) : null}
        <MerchantProductForm
          mode="stack"
          shopId={route.params?.shopId}
          productId={route.params?.productId}
          onSuccess={() => navigation.goBack()}
          onDeleted={() => navigation.goBack()}
          onNeedShop={() => navigation.navigate("MerchantShops")}
          onUpgradeToPremium={() => navigation.navigate("MerchantSubscription")}
        />
      </View>
    );
  }

  return (
    <MerchantMobileShell
      omitBottomTabBar
      customHeader={
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {t("merchant.products.newTitle")}
          </Text>
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={[styles.pad, { paddingBottom: scrollPad }]}
        keyboardShouldPersistTaps="handled"
        testID="merchant-product-form-ingredient"
      >
        <KindSelector kind={kind} onChange={setKind} />
        <Text style={styles.hint}>
          {t("merchant.millIngredients.unifiedHint")}
        </Text>
        <MillIngredientOfferForm
          onSuccess={() =>
            navigation.navigate("MerchantProducts", {
              kindFilter: "ingredients"
            })
          }
          onCancel={() => navigation.goBack()}
        />
      </ScrollView>
    </MerchantMobileShell>
  );
}

function KindSelector({
  kind,
  onChange
}: {
  kind: CreateKind;
  onChange: (k: CreateKind) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.selector} testID="mill-create-kind-selector">
      <Pressable
        style={[styles.seg, kind === "ingredient" && styles.segOn]}
        onPress={() => onChange("ingredient")}
        testID="mill-create-kind-ingredient"
      >
        <Text style={[styles.segTx, kind === "ingredient" && styles.segTxOn]}>
          {t("merchant.products.kindIngredient")}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.seg, kind === "product" && styles.segOn]}
        onPress={() => onChange("product")}
        testID="mill-create-kind-product"
      >
        <Text style={[styles.segTx, kind === "product" && styles.segTxOn]}>
          {t("merchant.products.kindOther")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  selectorWrap: {
    paddingHorizontal: mobileSpacing.md,
    paddingTop: mobileSpacing.md,
    backgroundColor: mobileColors.background
  },
  header: { paddingHorizontal: mobileSpacing.md, paddingVertical: 10 },
  headerTitle: {
    fontSize: mobileFontSize.lg,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  pad: {
    padding: mobileSpacing.md,
    gap: mobileSpacing.md,
  },
  hint: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary
  },
  selector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: mobileSpacing.sm
  },
  seg: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingVertical: 12,
    alignItems: "center"
  },
  segOn: {
    borderColor: merchantColors.primary,
    backgroundColor: merchantColors.primaryLight
  },
  segTx: { fontWeight: "700", color: mobileColors.textPrimary },
  segTxOn: { color: merchantColors.primary }
});
