import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppDatePicker } from "../components/common/AppDatePicker";
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { CounterProposalModal } from "../components/marketplace/CounterProposalModal";
import { ListingModal } from "../components/marketplace/ListingModal";
import { isFlatPriceListing } from "../components/marketplace/listingPricing";
import { ProposalModal } from "../components/marketplace/ProposalModal";
import {
  formatMarketMoney,
  parseMarketNum
} from "../components/marketplace/MarketplaceListingCard";
import { ListingImage } from "../components/marketplace/ListingImage";
import { listingPhotoUrlsArray } from "../lib/resolveListingImage";
import { SaleConfirmModal } from "../components/marketplace/SaleConfirmModal";
import { useModal } from "../components/modals/useModal";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { SecondaryButton } from "../components/ui/SecondaryButton";
import { FarmInfoCard } from "../components/market/FarmInfoCard";
import { HealthSummarySection } from "../components/market/HealthSummarySection";
import {
  DetailCard,
  DetailRow,
  DetailSectionLabel,
  ListingStatusBadge
} from "../components/marketplace/listingDetailUi";
import { useSession } from "../context/SessionContext";
import { useScrollBottomPad } from "../hooks/useScrollBottomPad";
import { formatAnimalDisplayLabel } from "../lib/animalDisplay";
import {
  acceptMarketplaceOffer,
  acceptMarketplaceOfferCounter,
  cancelMarketplaceListing,
  completeMarketplaceHandover,
  counterMarketplaceOffer,
  ensureDirectChatRoom,
  fetchMarketplaceListing,
  patchMarketplacePickup,
  postMarketplaceListingConsult,
  postMarketplaceListingView,
  postMarketplaceOffer,
  publishMarketplaceListing,
  rejectMarketplaceOffer,
  renewMarketplaceListing,
  type MarketplaceOfferBrief
} from "../lib/api";
import {
  listingStatusLabel,
  marketplaceActionErrorMessage,
  offerStatusLabel
} from "../lib/marketplaceLabels";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { ListingDurationDays } from "../lib/marketplaceListingForm";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "MarketplaceListingDetail"
>;

function formatMoney(
  v: string | number | null | undefined,
  currency: string
): string {
  const n = parseMarketNum(v);
  if (n == null) return "—";
  return formatMarketMoney(n, currency);
}

export function MarketplaceListingDetailScreen({
  route,
  navigation
}: Props) {
  const { t } = useTranslation();
  const { listingId } = route.params;
  const { accessToken, activeProfileId, authMe, clientFeatures } =
    useSession();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { open } = useModal();

  const showSuccess = (message: string, title?: string) => {
    open("success", { message, title, autoDismissMs: 2200 });
  };

  const [pickupAtStr, setPickupAtStr] = useState("");
  const [pickupNoteStr, setPickupNoteStr] = useState("");
  const [proposalOpen, setProposalOpen] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [activeOffer, setActiveOffer] = useState<MarketplaceOfferBrief | null>(
    null
  );
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [publishDurationDays, setPublishDurationDays] =
    useState<ListingDurationDays>(14);

  const q = useQuery({
    queryKey: ["marketplaceListing", listingId, activeProfileId],
    queryFn: () =>
      fetchMarketplaceListing(accessToken, listingId, activeProfileId),
    enabled: clientFeatures.marketplace
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: route.params?.headline?.trim() || t("marketScreen.detailTitle")
    });
  }, [navigation, route.params?.headline, t]);

  useEffect(() => {
    const L = q.data;
    if (!L || L.status !== "published" || !accessToken) return;
    void postMarketplaceListingView(accessToken, listingId, activeProfileId).catch(
      () => undefined
    );
    const myId = authMe?.user.id;
    const isSeller = myId && L.sellerUserId === myId;
    if (!isSeller) {
      void postMarketplaceListingConsult(
        accessToken,
        listingId,
        activeProfileId
      ).catch(() => undefined);
    }
  }, [
    q.data?.id,
    q.data?.status,
    q.data?.sellerUserId,
    accessToken,
    listingId,
    activeProfileId,
    authMe?.user.id
  ]);

  useEffect(() => {
    const L = q.data;
    if (!L) return;
    setPickupAtStr(L.pickupAt ?? "");
    setPickupNoteStr(L.pickupNote ?? "");
  }, [q.data?.pickupAt, q.data?.pickupNote, q.data?.id]);

  const contactSellerMutation = useMutation({
    mutationFn: (sellerUserId: string) =>
      ensureDirectChatRoom(
        accessToken!,
        sellerUserId,
        activeProfileId,
        listingId
      ),
    onSuccess: (room) => {
      navigation.navigate("ChatRoom", {
        roomId: room.id,
        headline: room.title?.trim() || t("marketScreen.detail.chatTitle"),
        listingId
      });
    },
    onError: (e: Error) =>
      Alert.alert(t("marketScreen.detail.contactErrorTitle"), getUserFacingError(e, t))
  });

  const proposalMutation = useMutation({
    mutationFn: (input: {
      proposedPricePerKg?: number;
      offeredPrice?: number;
      message?: string;
    }) =>
      postMarketplaceOffer(
        accessToken,
        listingId,
        {
          ...(input.offeredPrice != null
            ? { offeredPrice: input.offeredPrice }
            : { proposedPricePerKg: input.proposedPricePerKg }),
          message: input.message
        },
        activeProfileId
      ),
    onSuccess: () => {
      setProposalOpen(false);
      showSuccess(t("marketScreen.proposalModal.success"));
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
      void qc.invalidateQueries({ queryKey: ["marketplaceMyOffers"] });
    },
    onError: (e: Error) => {
      Alert.alert(
        t("marketScreen.proposalModal.errorTitle"),
        marketplaceActionErrorMessage(e, t)
      );
    }
  });

  const acceptMutation = useMutation({
    mutationFn: (offerId: string) =>
      acceptMarketplaceOffer(
        accessToken,
        listingId,
        offerId,
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
      void qc.invalidateQueries({ queryKey: ["marketplaceListings"] });
      void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
      if (activeOffer) {
        setSaleOpen(true);
      } else {
        showSuccess(
          t("marketScreen.acceptSuccessBody"),
          t("marketScreen.acceptSuccessTitle")
        );
      }
    },
    onError: (e: Error) =>
      Alert.alert(
        "Action impossible",
        marketplaceActionErrorMessage(e, t)
      )
  });

  const rejectMutation = useMutation({
    mutationFn: (offerId: string) =>
      rejectMarketplaceOffer(
        accessToken,
        listingId,
        offerId,
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
      void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
      showSuccess(t("marketScreen.offerRejectSuccess"));
    },
    onError: (e: Error) =>
      Alert.alert(
        "Action impossible",
        marketplaceActionErrorMessage(e, t)
      )
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      publishMarketplaceListing(
        accessToken,
        listingId,
        activeProfileId,
        publishDurationDays
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
      void qc.invalidateQueries({ queryKey: ["marketplaceListings"] });
      void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
      showSuccess(t("marketScreen.publishSuccess"));
    },
    onError: (e: Error) =>
      Alert.alert(
        "Publication impossible",
        marketplaceActionErrorMessage(e, t)
      )
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      cancelMarketplaceListing(accessToken, listingId, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
      void qc.invalidateQueries({ queryKey: ["marketplaceListings"] });
      void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
      showSuccess(t("marketScreen.cancelSuccess"));
    },
    onError: (e: Error) =>
      Alert.alert(
        "Annulation impossible",
        marketplaceActionErrorMessage(e, t)
      )
  });

  const pickupMutation = useMutation({
    mutationFn: () => {
      const pickupAt = pickupAtStr.trim() || null;
      return patchMarketplacePickup(
        accessToken,
        listingId,
        {
          pickupAt,
          pickupNote: pickupNoteStr.trim() || null
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
      Alert.alert("Enregistré", "Rendez-vous de retrait mis à jour.");
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const handoverMutation = useMutation({
    mutationFn: (payload: {
      offerId: string;
      soldWeightKg: number;
      totalPrice: number;
      soldAt?: string;
      notes?: string;
    }) =>
      completeMarketplaceHandover(
        accessToken,
        listingId,
        payload,
        activeProfileId
      ),
    onSuccess: () => {
      setSaleOpen(false);
      showSuccess(t("marketScreen.saleModal.success"));
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
      void qc.invalidateQueries({ queryKey: ["marketplaceListings"] });
      void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const counterMut = useMutation({
    mutationFn: (input: {
      offerId: string;
      counterPricePerKg?: number;
      counterOfferedPrice?: number;
    }) =>
      counterMarketplaceOffer(
        accessToken,
        listingId,
        input.offerId,
        {
          ...(input.counterOfferedPrice != null
            ? { counterOfferedPrice: input.counterOfferedPrice }
            : { counterPricePerKg: input.counterPricePerKg })
        },
        activeProfileId
      ),
    onSuccess: () => {
      setCounterOpen(false);
      showSuccess(t("marketScreen.counterModal.success"));
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const acceptCounterMut = useMutation({
    mutationFn: (offerId: string) =>
      acceptMarketplaceOfferCounter(
        accessToken,
        listingId,
        offerId,
        activeProfileId
      ),
    onSuccess: () => {
      showSuccess(t("marketScreen.counterModal.accepted"));
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const renewMut = useMutation({
    mutationFn: () =>
      renewMarketplaceListing(accessToken, listingId, 14, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
      showSuccess(t("marketScreen.renewSuccess"));
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const buyerFooterHeight = useMemo(() => {
    const L = q.data;
    if (!L) {
      return 0;
    }
    const myId = authMe?.user.id;
    const isSeller = Boolean(myId && L.sellerUserId === myId);
    const canSubmitOffer = Boolean(myId && !isSeller && L.status === "published");
    const showFooter = !isSeller && (canSubmitOffer || L.status === "published");
    return showFooter ? 140 : 0;
  }, [q.data, authMe?.user.id]);

  const scrollBottomPad = useScrollBottomPad({
    stickyFooterHeight: buyerFooterHeight
  });

  const loading = q.isPending;
  const err =
    q.error instanceof Error ? q.error.message : q.error ? String(q.error) : null;

  if (!clientFeatures.marketplace) {
    return (
      <MarketplaceModuleGate>
        <View />
      </MarketplaceModuleGate>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  if (err || !q.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err || "Annonce introuvable."}</Text>
      </View>
    );
  }

  const L = q.data;
  const myId = authMe?.user.id;
  const isSeller = Boolean(myId && L.sellerUserId === myId);
  const photos = listingPhotoUrlsArray(L.photoUrls);
  const wKg = parseMarketNum(L.totalWeightKg);
  const pKg = parseMarketNum(L.pricePerKg);
  const askTotal = parseMarketNum(L.totalPrice);
  const flatPrice = isFlatPriceListing(L.category);
  const canSubmitOffer =
    Boolean(myId) && !isSeller && L.status === "published";

  const isAcceptedBuyer =
    Boolean(myId && L.myOffers?.some((o) => o.status === "accepted"));
  const canEditPickup =
    L.status === "reserved" && (isSeller || isAcceptedBuyer);

  const categoryKey = L.category ?? "unknown";
  const screenW = Dimensions.get("window").width;
  const views = L.viewsCount ?? 0;
  const consults = L.consultationsCount ?? 0;

  const showBuyerFooter = buyerFooterHeight > 0;

  return (
    <>
    <View style={styles.screen}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPad }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heroWrap}>
        {photos.length > 1 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
          >
            {photos.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={[styles.heroImg, { width: screenW }]}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        ) : (
          <ListingImage
            photos={L.photoUrls}
            fallbackPhotoUrl={L.fallbackPhotoUrl}
            animal={L.animal}
            height={240}
            borderRadius={0}
          />
        )}
        <View style={styles.heroCatBadge}>
          <Text style={styles.heroCatBadgeTx}>
            {t(`marketScreen.categories.${categoryKey}`, {
              defaultValue: t("marketScreen.categories.unknown")
            })}
          </Text>
        </View>
      </View>

      <DetailCard>
        <ListingStatusBadge
          status={L.status}
          label={listingStatusLabel(L.status)}
        />
        {flatPrice && askTotal != null ? (
          <>
            <Text style={styles.priceMain}>
              {formatMoney(askTotal, L.currency)}
            </Text>
            <Text style={styles.priceSub}>{t("marketScreen.flatPriceLabel")}</Text>
          </>
        ) : pKg != null ? (
          <>
            <Text style={styles.priceMain}>
              {formatMoney(pKg, L.currency)}
              <Text style={styles.pricePerKg}>/kg</Text>
            </Text>
            {wKg != null ? (
              <Text style={styles.priceSub}>
                {t("marketScreen.totalWeight")}{" "}
                {wKg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg
              </Text>
            ) : null}
            <Text style={styles.priceTotal}>
              {t("marketScreen.totalPrice")}{" "}
              {formatMoney(
                L.totalPrice ?? (pKg != null && wKg != null ? pKg * wKg : null),
                L.currency
              )}
            </Text>
          </>
        ) : askTotal != null ? (
          <Text style={styles.priceMain}>{formatMoney(askTotal, L.currency)}</Text>
        ) : null}
        <Text style={styles.statsRow}>
          👁 {views} · 💬 {consults}
        </Text>
      </DetailCard>
      {L.status === "expired" && isSeller ? (
        <View style={styles.section}>
          <PrimaryButton
            label={t("marketScreen.renewAction")}
            onPress={() => renewMut.mutate()}
            loading={renewMut.isPending}
          />
        </View>
      ) : null}
      <HealthSummarySection healthData={L.healthData} />
      <FarmInfoCard
        farmInfo={L.farmInfo}
        onViewFarmListings={(farm) =>
          navigation.navigate("MarketplaceList", {
            searchQuery: farm.farmName
          })
        }
      />
      {L.status === "sold" ? (
        <Text style={styles.closedBanner}>
          {t("marketScreen.soldBanner")}
        </Text>
      ) : null}
      {L.status === "cancelled" ? (
        <Text style={styles.closedBanner}>
          {t("marketScreen.cancelledBanner")}
        </Text>
      ) : null}
      {L.status === "reserved" ? (
        <Text style={styles.reservedBanner}>
          {t("marketScreen.reservedBanner")}
        </Text>
      ) : null}
      {L.animal ? (
        <DetailCard>
          <DetailSectionLabel>{t("marketScreen.detail.animalSection")}</DetailSectionLabel>
          <DetailRow
            label={t("marketScreen.detail.animalId")}
            value={formatAnimalDisplayLabel(L.animal)}
          />
          {L.breedLabel ? (
            <DetailRow label={t("marketScreen.detail.breed")} value={L.breedLabel} />
          ) : null}
          {wKg != null ? (
            <DetailRow
              label={t("marketScreen.detail.weight")}
              value={`${wKg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`}
            />
          ) : null}
          <DetailRow
            label={t("marketScreen.detail.category")}
            value={t(`marketScreen.categories.${categoryKey}`, {
              defaultValue: categoryKey
            })}
          />
        </DetailCard>
      ) : null}

      {L.description ? (
        <DetailCard>
          <DetailSectionLabel>{t("marketScreen.detail.description")}</DetailSectionLabel>
          <Text style={styles.desc}>{L.description}</Text>
        </DetailCard>
      ) : null}

      {canEditPickup ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rendez-vous de retrait</Text>
          <Text style={styles.hintSmall}>
            Vendeur et acheteur peuvent ajuster le créneau après accord.
          </Text>
          <AppDatePicker
            label="Date et heure de retrait"
            mode="datetime"
            isoValue={pickupAtStr}
            onIsoChange={setPickupAtStr}
            minDate={new Date()}
          />
          <Text style={styles.labelSmall}>Note (lieu, créneau…)</Text>
          <TextInput
            style={[styles.pickupInput, styles.pickupNote]}
            value={pickupNoteStr}
            onChangeText={setPickupNoteStr}
            multiline
            placeholder="Ex. enlèvement à la porcherie, badge …"
          />
          <TouchableOpacity
            style={styles.pickupSave}
            disabled={pickupMutation.isPending}
            onPress={() => pickupMutation.mutate()}
          >
            <Text style={styles.pickupSaveTxt}>
              {pickupMutation.isPending ? "Enregistrement…" : "Enregistrer le RDV"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isSeller && (L.status === "draft" || L.status === "published") ? (
        <DetailCard>
          <DetailSectionLabel>{t("marketScreen.detail.sellerActions")}</DetailSectionLabel>
          {L.status === "draft" ? (
            <Text style={styles.sellerHint}>
              {t("marketScreen.createForm.draftHint")}
            </Text>
          ) : null}
          {L.status === "draft" ? (
            <>
              <Text style={styles.labelSmall}>
                {t("marketScreen.createForm.sectionDuration")}
              </Text>
              <View style={styles.durationRow}>
                {([7, 14, 30] as const).map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.durationChip,
                      publishDurationDays === d && styles.durationChipOn
                    ]}
                    onPress={() => setPublishDurationDays(d)}
                  >
                    <Text
                      style={[
                        styles.durationChipTx,
                        publishDurationDays === d && styles.durationChipTxOn
                      ]}
                    >
                      {t("marketScreen.createForm.durationDays", { count: d })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <PrimaryButton
                label={
                  publishMutation.isPending
                    ? t("marketScreen.publishing")
                    : t("marketScreen.publishAction")
                }
                onPress={() =>
                  Alert.alert(
                    t("marketScreen.publishConfirmTitle"),
                    t("marketScreen.publishConfirmBody"),
                    [
                      { text: t("marketScreen.publishCancel"), style: "cancel" },
                      {
                        text: t("marketScreen.publishAction"),
                        onPress: () => publishMutation.mutate()
                      }
                    ]
                  )
                }
                loading={publishMutation.isPending}
                disabled={
                  cancelMutation.isPending ||
                  acceptMutation.isPending ||
                  rejectMutation.isPending
                }
              />
            </>
          ) : null}
          <SecondaryButton
            label={t("marketScreen.detail.editListing")}
            onPress={() => setEditModalOpen(true)}
            disabled={
              publishMutation.isPending ||
              cancelMutation.isPending ||
              acceptMutation.isPending ||
              rejectMutation.isPending
            }
            style={{ marginTop: mobileSpacing.sm }}
          />
          <Pressable
            style={styles.cancelTextBtn}
            disabled={
              publishMutation.isPending ||
              cancelMutation.isPending ||
              acceptMutation.isPending ||
              rejectMutation.isPending
            }
            onPress={() =>
              Alert.alert(
                t("marketScreen.detail.cancelConfirmTitle"),
                t("marketScreen.detail.cancelConfirmBody"),
                [
                  { text: t("marketScreen.publishCancel"), style: "cancel" },
                  {
                    text: t("marketScreen.detail.cancelAction"),
                    style: "destructive",
                    onPress: () => cancelMutation.mutate()
                  }
                ]
              )
            }
          >
            <Text style={styles.cancelTextBtnTx}>
              {cancelMutation.isPending
                ? t("marketScreen.detail.cancelling")
                : t("marketScreen.detail.cancelAction")}
            </Text>
          </Pressable>
        </DetailCard>
      ) : null}

      {isSeller && L.offers && L.offers.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offres reçues</Text>
          {L.offers.map((o) => (
            <View key={o.id} style={styles.offerCard}>
              <Text style={styles.block}>
                {formatMoney(o.offeredPrice, L.currency)}
                {o.quantity != null ? ` × ${o.quantity}` : ""} —{" "}
                {offerStatusLabel(o.status)}
              </Text>
              {o.buyer?.fullName ? (
                <Text style={styles.offerBuyer}>Acheteur : {o.buyer.fullName}</Text>
              ) : null}
              {o.message ? (
                <Text style={styles.offerMsg}>{o.message}</Text>
              ) : null}
              {o.status === "pending" &&
              L.status === "published" &&
              !acceptMutation.isPending &&
              !rejectMutation.isPending ? (
                <View style={styles.offerActions}>
                  <TouchableOpacity
                    style={styles.btnAccept}
                    onPress={() => {
                      setActiveOffer(o);
                      acceptMutation.mutate(o.id);
                    }}
                  >
                    <Text style={styles.btnAcceptTxt}>
                      {t("marketScreen.offerAccept")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnCounter}
                    onPress={() => {
                      setActiveOffer(o);
                      setCounterOpen(true);
                    }}
                  >
                    <Text style={styles.btnCounterTxt}>
                      {t("marketScreen.offerCounter")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnReject}
                    onPress={() => rejectMutation.mutate(o.id)}
                  >
                    <Text style={styles.btnRejectTxt}>
                      {t("marketScreen.offerReject")}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {!isSeller && L.myOffers && L.myOffers.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("marketScreen.myOffersTitle")}
          </Text>
          {L.myOffers.map((o) => (
            <View key={o.id} style={styles.offerCard}>
              <Text style={styles.block}>
                {formatMoney(o.offeredPrice, L.currency)} —{" "}
                {offerStatusLabel(o.status)}
              </Text>
              {o.status === "countered" ? (
                <PrimaryButton
                  label={t("marketScreen.acceptCounter")}
                  onPress={() => acceptCounterMut.mutate(o.id)}
                  loading={acceptCounterMut.isPending}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {isSeller && L.status === "reserved" ? (
        <DetailCard>
          <PrimaryButton
            label={t("marketScreen.saleModal.open")}
            onPress={() => {
              const accepted = L.offers?.find((o) => o.status === "accepted");
              if (accepted) {
                setActiveOffer(accepted);
                setSaleOpen(true);
              }
            }}
          />
        </DetailCard>
      ) : null}
    </ScrollView>

    {showBuyerFooter ? (
      <View
        style={[
          styles.footerBar,
          { paddingBottom: Math.max(insets.bottom, mobileSpacing.md) }
        ]}
      >
        {canSubmitOffer ? (
          <PrimaryButton
            label={t("marketScreen.detail.makeProposal")}
            onPress={() => setProposalOpen(true)}
          />
        ) : null}
        {L.status === "published" && L.sellerUserId ? (
          <SecondaryButton
            label={t("marketScreen.detail.contactSeller")}
            onPress={() => contactSellerMutation.mutate(L.sellerUserId)}
            loading={contactSellerMutation.isPending}
            style={{ marginTop: mobileSpacing.sm }}
          />
        ) : null}
      </View>
    ) : null}
    </View>

    <ProposalModal
      visible={proposalOpen}
      listing={L}
      submitting={proposalMutation.isPending}
      onClose={() => setProposalOpen(false)}
      onSubmit={(payload) => proposalMutation.mutate(payload)}
    />
    <CounterProposalModal
      visible={counterOpen}
      listing={L}
      offer={activeOffer}
      submitting={counterMut.isPending}
      onClose={() => setCounterOpen(false)}
      onSubmit={(payload) => {
        if (!activeOffer) return;
        counterMut.mutate({
          offerId: activeOffer.id,
          counterPricePerKg: payload.counterPricePerKg,
          counterOfferedPrice: payload.counterOfferedPrice
        });
      }}
    />
    <SaleConfirmModal
      visible={saleOpen}
      listing={L}
      offer={activeOffer}
      submitting={handoverMutation.isPending}
      onClose={() => setSaleOpen(false)}
      onConfirm={(payload) => handoverMutation.mutate(payload)}
    />
    {isSeller ? (
      <ListingModal
        visible={editModalOpen}
        mode="edit"
        listingId={listingId}
        lockFarm
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => {
          void q.refetch();
        }}
      />
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  scroll: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  cardsPad: {
    paddingHorizontal: mobileSpacing.lg
  },
  content: {},
  heroWrap: {
    position: "relative",
    marginBottom: mobileSpacing.md,
    backgroundColor: mobileColors.surfaceMuted
  },
  heroImg: { height: 240 },
  heroCatBadge: {
    position: "absolute",
    top: mobileSpacing.md,
    left: mobileSpacing.md,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 4,
    borderRadius: mobileRadius.sm
  },
  heroCatBadgeTx: {
    ...mobileTypography.meta,
    color: "#fff",
    fontWeight: "700"
  },
  footerBar: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border,
    ...mobileShadows.card
  },
  sellerRow: {
    flexDirection: "row",
    gap: mobileSpacing.md,
    alignItems: "flex-start"
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  sellerAvatarTx: {
    fontWeight: "800",
    color: mobileColors.accent,
    fontSize: 16
  },
  sellerMeta: { flex: 1, gap: 2 },
  sellerName: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  sellerFarm: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    fontSize: 14
  },
  sellerLoc: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  statsRow: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  pricePerKg: {
    fontSize: 18,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  cancelTextBtn: {
    alignSelf: "center",
    marginTop: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm
  },
  cancelTextBtnTx: {
    ...mobileTypography.body,
    color: mobileColors.error,
    fontWeight: "700"
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.lg,
    backgroundColor: mobileColors.canvas
  },
  error: {
    color: mobileColors.error,
    textAlign: "center"
  },
  status: {
    fontSize: 13,
    color: "#6d745b",
    marginBottom: 8
  },
  closedBanner: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b5420",
    backgroundColor: "#f0e8d8",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    lineHeight: 20
  },
  reservedBanner: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2d5a6e",
    backgroundColor: "#e8f4f8",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    lineHeight: 20
  },
  hintSmall: {
    fontSize: 12,
    color: "#6d745b",
    marginBottom: 8,
    lineHeight: 17
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6d745b",
    marginBottom: 4,
    marginTop: 8
  },
  pickupInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e4d4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1f2910"
  },
  pickupNote: {
    minHeight: 72,
    textAlignVertical: "top"
  },
  pickupSave: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#5d7a1f",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12
  },
  pickupSaveTxt: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15
  },
  handoverBtn: {
    marginTop: 8,
    backgroundColor: "#c4a574",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center"
  },
  handoverBtnTxt: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15
  },
  price: {
    fontSize: 22,
    fontWeight: "700",
    color: "#5d7a1f",
    marginBottom: 12
  },
  desc: {
    fontSize: 16,
    color: "#1f2910",
    lineHeight: 24,
    marginBottom: 16
  },
  muted: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
    marginBottom: 16
  },
  section: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e4d4"
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6d745b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8
  },
  hint: {
    fontSize: 12,
    color: "#6d745b",
    marginBottom: 6,
    marginTop: 8
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e4d4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2910"
  },
  inputMulti: {
    minHeight: 88,
    textAlignVertical: "top"
  },
  submit: {
    marginTop: 16,
    backgroundColor: "#5d7a1f",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center"
  },
  submitDisabled: {
    opacity: 0.65
  },
  submitText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16
  },
  note: {
    marginTop: 16,
    fontSize: 13,
    color: "#8b4513",
    lineHeight: 18
  },
  block: {
    fontSize: 15,
    color: "#4b513d",
    lineHeight: 22
  },
  offerCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e0e4d4"
  },
  offerBuyer: {
    fontSize: 13,
    color: "#6d745b",
    marginTop: 6
  },
  offerMsg: {
    fontSize: 13,
    color: "#4b513d",
    marginTop: 6,
    fontStyle: "italic"
  },
  offerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 8
  },
  btnAccept: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: mobileColors.accent,
    paddingVertical: 10,
    borderRadius: mobileRadius.md,
    alignItems: "center"
  },
  btnAcceptTxt: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13
  },
  btnCounter: {
    flex: 1,
    minWidth: "30%",
    borderWidth: 1,
    borderColor: mobileColors.accent,
    paddingVertical: 10,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    backgroundColor: mobileColors.background
  },
  btnCounterTxt: {
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: 13
  },
  btnReject: {
    flex: 1,
    minWidth: "30%",
    borderWidth: 1,
    borderColor: mobileColors.error,
    paddingVertical: 10,
    borderRadius: mobileRadius.md,
    alignItems: "center"
  },
  btnRejectTxt: {
    color: mobileColors.error,
    fontWeight: "700",
    fontSize: 13
  },
  gallery: { marginBottom: mobileSpacing.md },
  gallerySingle: { marginBottom: mobileSpacing.md },
  galleryContent: { gap: mobileSpacing.sm },
  galleryImg: {
    width: 200,
    height: 140,
    borderRadius: mobileRadius.lg,
    backgroundColor: mobileColors.surfaceMuted
  },
  priceBlock: {
    marginBottom: mobileSpacing.md,
    gap: 4
  },
  priceMain: {
    ...mobileTypography.title,
    color: mobileColors.accent
  },
  priceSub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  priceTotal: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  rating: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  sellerHint: {
    fontSize: 13,
    color: "#8b4513",
    marginBottom: 12,
    lineHeight: 18
  },
  sellerBtnPrimary: {
    backgroundColor: "#5d7a1f",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10
  },
  sellerBtnPrimaryTxt: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16
  },
  sellerBtnSecondary: {
    borderWidth: 2,
    borderColor: "#5d7a1f",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: "#fff"
  },
  sellerBtnSecondaryTxt: {
    color: "#5d7a1f",
    fontWeight: "700",
    fontSize: 15
  },
  sellerBtnDanger: {
    borderWidth: 2,
    borderColor: "#b00020",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#fff"
  },
  sellerBtnDangerTxt: {
    color: "#b00020",
    fontWeight: "700",
    fontSize: 15
  },
  sellerBtnDisabled: {
    opacity: 0.55
  },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.xs,
    marginBottom: mobileSpacing.md
  },
  durationChip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.surfaceMuted
  },
  durationChipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  durationChipTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  durationChipTxOn: {
    color: mobileColors.accent,
    fontWeight: "700"
  }
});
