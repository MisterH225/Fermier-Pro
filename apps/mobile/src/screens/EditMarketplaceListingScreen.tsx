import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { MobileAppShell } from "../components/layout";
import { ModalSection } from "../components/modals/ModalSection";
import { useSession } from "../context/SessionContext";
import {
  fetchMarketplaceListing,
  type UpdateMarketplaceListingPayload,
  updateMarketplaceListing
} from "../lib/api";
import { marketplaceActionErrorMessage } from "../lib/marketplaceLabels";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "EditMarketplaceListing">;

export function EditMarketplaceListingScreen({ navigation, route }: Props) {
  const { listingId } = route.params;
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe, clientFeatures } = useSession();
  const qc = useQueryClient();
  const synced = useRef(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [locationLabel, setLocationLabel] = useState("");

  const q = useQuery({
    queryKey: ["marketplaceListing", listingId, activeProfileId],
    queryFn: () =>
      fetchMarketplaceListing(accessToken, listingId, activeProfileId),
    enabled: clientFeatures.marketplace
  });

  useEffect(() => {
    synced.current = false;
  }, [listingId]);

  useEffect(() => {
    const L = q.data;
    if (!L || synced.current) {
      return;
    }
    synced.current = true;
    setTitle(L.title);
    setDescription(L.description ?? "");
    if (L.unitPrice != null) {
      const n =
        typeof L.unitPrice === "string"
          ? Number.parseFloat(L.unitPrice)
          : Number(L.unitPrice);
      setUnitPrice(Number.isFinite(n) ? String(n) : "");
    } else {
      setUnitPrice("");
    }
    setQuantity(L.quantity != null ? String(L.quantity) : "");
    setCurrency(L.currency ?? "XOF");
    setLocationLabel(L.locationLabel ?? "");
  }, [q.data]);

  const mut = useMutation({
    mutationFn: () => {
      const trimmed = title.trim();
      if (!trimmed) {
        throw new Error("Le titre est obligatoire.");
      }
      const payload: UpdateMarketplaceListingPayload = {
        title: trimmed,
        description: description.trim() ? description.trim() : null,
        currency: currency.trim() || "XOF",
        locationLabel: locationLabel.trim() ? locationLabel.trim() : null
      };
      const rawPrice = unitPrice.trim().replace(",", ".");
      if (rawPrice) {
        const p = Number.parseFloat(rawPrice);
        if (!Number.isFinite(p) || p < 0) {
          throw new Error("Prix unitaire invalide.");
        }
        payload.unitPrice = p;
      } else {
        payload.unitPrice = null;
      }
      const rawQty = quantity.trim();
      if (rawQty) {
        const qn = Number.parseInt(rawQty, 10);
        if (!Number.isFinite(qn) || qn < 1) {
          throw new Error("Quantité : entier positif ou champ vide.");
        }
        payload.quantity = qn;
      } else {
        payload.quantity = null;
      }
      return updateMarketplaceListing(
        accessToken,
        listingId,
        payload,
        activeProfileId
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
      void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
      void qc.invalidateQueries({ queryKey: ["marketplaceListings"] });
      navigation.goBack();
    },
    onError: (e: Error) =>
      Alert.alert(
        t("marketScreen.createForm.errorTitle"),
        marketplaceActionErrorMessage(e.message)
      )
  });

  const err =
    q.error instanceof Error ? q.error.message : q.error ? String(q.error) : null;

  if (!clientFeatures.marketplace) {
    return (
      <MarketplaceModuleGate>
        <View />
      </MarketplaceModuleGate>
    );
  }

  if (q.isPending || !q.data) {
    return (
      <MobileAppShell hideTopBar>
        <View style={styles.centered}>
          {err ? (
            <Text style={styles.error}>{err}</Text>
          ) : (
            <ActivityIndicator size="large" color={mobileColors.accent} />
          )}
        </View>
      </MobileAppShell>
    );
  }

  const L = q.data;
  const myId = authMe?.user.id;
  if (!myId || L.sellerUserId !== myId) {
    return (
      <MobileAppShell hideTopBar>
        <View style={styles.centered}>
          <Text style={styles.error}>Tu ne peux modifier que tes propres annonces.</Text>
        </View>
      </MobileAppShell>
    );
  }

  if (L.status === "sold" || L.status === "cancelled") {
    return (
      <MobileAppShell hideTopBar>
        <View style={styles.centered}>
          <Text style={styles.error}>
            Cette annonce est clôturée et ne peut plus être modifiée.
          </Text>
        </View>
      </MobileAppShell>
    );
  }

  return (
    <MobileAppShell hideTopBar>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.meta}>
            Ferme / animal ne sont pas modifiables après création.
          </Text>

          <ModalSection title={t("marketScreen.createForm.sectionListing")}>
            <Text style={styles.lab}>{t("marketScreen.createForm.title")} *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={t("marketScreen.createForm.titlePlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
            />

            <Text style={styles.lab}>{t("marketScreen.createForm.description")}</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={description}
              onChangeText={setDescription}
              placeholder={t("marketScreen.createForm.descriptionPlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
              multiline
            />
          </ModalSection>

          <ModalSection title={t("marketScreen.createForm.sectionPricing")}>
            <Text style={styles.lab}>{t("marketScreen.createForm.unitPrice")}</Text>
            <TextInput
              style={styles.input}
              value={unitPrice}
              onChangeText={setUnitPrice}
              keyboardType="decimal-pad"
              placeholderTextColor={mobileColors.textSecondary}
            />

            <Text style={styles.lab}>{t("marketScreen.createForm.quantity")}</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              placeholderTextColor={mobileColors.textSecondary}
            />

            <Text style={styles.lab}>{t("marketScreen.createForm.currency")}</Text>
            <TextInput
              style={styles.input}
              value={currency}
              onChangeText={setCurrency}
              autoCapitalize="characters"
              placeholderTextColor={mobileColors.textSecondary}
            />
          </ModalSection>

          <ModalSection title={t("marketScreen.createForm.sectionLocation")}>
            <Text style={styles.lab}>{t("marketScreen.createForm.location")}</Text>
            <TextInput
              style={styles.input}
              value={locationLabel}
              onChangeText={setLocationLabel}
              placeholder={t("marketScreen.createForm.locationPlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
            />
          </ModalSection>

          <Pressable
            style={[styles.submit, mut.isPending && styles.submitDisabled]}
            disabled={mut.isPending || !title.trim()}
            onPress={() => mut.mutate()}
          >
            {mut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitTx}>Enregistrer</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl,
    gap: mobileSpacing.md
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.xl
  },
  error: {
    color: mobileColors.error,
    textAlign: "center",
    ...mobileTypography.body
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    lineHeight: 18
  },
  lab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4,
    marginTop: mobileSpacing.xs
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.surfaceMuted
  },
  inputMulti: {
    minHeight: 96,
    textAlignVertical: "top"
  },
  submit: {
    marginTop: mobileSpacing.sm,
    backgroundColor: mobileColors.accent,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    alignItems: "center"
  },
  submitDisabled: { opacity: 0.55 },
  submitTx: {
    ...mobileTypography.body,
    color: "#fff",
    fontWeight: "700"
  }
});
