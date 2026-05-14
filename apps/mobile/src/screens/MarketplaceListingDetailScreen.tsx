import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { useSession } from "../context/SessionContext";
import {
  acceptMarketplaceOffer,
  cancelMarketplaceListing,
  completeMarketplaceHandover,
  fetchMarketplaceListing,
  patchMarketplacePickup,
  postMarketplaceListingView,
  postMarketplaceOffer,
  publishMarketplaceListing,
  rejectMarketplaceOffer
} from "../lib/api";
import {
  listingStatusLabel,
  marketplaceActionErrorMessage,
  offerStatusLabel
} from "../lib/marketplaceLabels";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "MarketplaceListingDetail"
>;

function formatMoney(
  v: string | number | null | undefined,
  currency: string
): string {
  if (v === undefined || v === null) {
    return "—";
  }
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  if (!Number.isFinite(n)) {
    return String(v);
  }
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;
}

export function MarketplaceListingDetailScreen({
  route,
  navigation
}: Props) {
  const { listingId } = route.params;
  const { accessToken, activeProfileId, authMe, clientFeatures } =
    useSession();
  const qc = useQueryClient();

  const [offerPrice, setOfferPrice] = useState("");
  const [offerQty, setOfferQty] = useState("");
  const [offerMsg, setOfferMsg] = useState("");
  const [pickupAtStr, setPickupAtStr] = useState("");
  const [pickupNoteStr, setPickupNoteStr] = useState("");

  const q = useQuery({
    queryKey: ["marketplaceListing", listingId, activeProfileId],
    queryFn: () =>
      fetchMarketplaceListing(accessToken, listingId, activeProfileId),
    enabled: clientFeatures.marketplace
  });

  useLayoutEffect(() => {
    const t = q.data?.title ?? route.params.headline;
    navigation.setOptions({
      title: t && t.length > 0 ? t : "Annonce"
    });
  }, [navigation, q.data?.title, route.params.headline]);

  useEffect(() => {
    const L = q.data;
    if (!L || L.status !== "published" || !accessToken) return;
    void postMarketplaceListingView(accessToken, listingId, activeProfileId).catch(
      () => undefined
    );
  }, [q.data?.id, q.data?.status, accessToken, listingId, activeProfileId]);

  useEffect(() => {
    const L = q.data;
    if (!L) return;
    setPickupAtStr(
      L.pickupAt ? L.pickupAt.slice(0, 16).replace("T", " ") : ""
    );
    setPickupNoteStr(L.pickupNote ?? "");
  }, [q.data?.pickupAt, q.data?.pickupNote, q.data?.id]);

  const offerMutation = useMutation({
    mutationFn: () => {
      const raw = offerPrice.trim().replace(",", ".");
      const priceNum = Number.parseFloat(raw);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        throw new Error("Indique un prix d’offre valide.");
      }
      let qty: number | undefined;
      const qt = offerQty.trim();
      if (qt) {
        const n = Number.parseInt(qt, 10);
        if (!Number.isFinite(n) || n < 1) {
          throw new Error("Quantité : entier positif ou champ vide.");
        }
        qty = n;
      }
      return postMarketplaceOffer(
        accessToken,
        listingId,
        {
          offeredPrice: priceNum,
          quantity: qty,
          message: offerMsg.trim() || undefined
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      setOfferPrice("");
      setOfferQty("");
      setOfferMsg("");
      void qc.invalidateQueries({
        queryKey: ["marketplaceListing", listingId]
      });
      void qc.invalidateQueries({ queryKey: ["marketplaceMyOffers"] });
      Alert.alert("Envoyé", "Ton offre a été enregistrée.");
    },
    onError: (e: Error) => {
      Alert.alert(
        "Impossible d’envoyer l’offre",
        marketplaceActionErrorMessage(e.message)
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
      Alert.alert(
        "Offre acceptée",
        "L’annonce est réservée pour cet acheteur. Fixez ensemble le rendez-vous de retrait (paiement hors application)."
      );
    },
    onError: (e: Error) =>
      Alert.alert(
        "Action impossible",
        marketplaceActionErrorMessage(e.message)
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
    },
    onError: (e: Error) =>
      Alert.alert(
        "Action impossible",
        marketplaceActionErrorMessage(e.message)
      )
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      publishMarketplaceListing(accessToken, listingId, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
      void qc.invalidateQueries({ queryKey: ["marketplaceListings"] });
      void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
      Alert.alert("Publiée", "Ton annonce est visible sur le marché.");
    },
    onError: (e: Error) =>
      Alert.alert(
        "Publication impossible",
        marketplaceActionErrorMessage(e.message)
      )
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      cancelMarketplaceListing(accessToken, listingId, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
      void qc.invalidateQueries({ queryKey: ["marketplaceListings"] });
      void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
      Alert.alert(
        "Annulée",
        "L’annonce est clôturée et les offres en attente ont été refusées."
      );
    },
    onError: (e: Error) =>
      Alert.alert(
        "Annulation impossible",
        marketplaceActionErrorMessage(e.message)
      )
  });

  const pickupMutation = useMutation({
    mutationFn: () => {
      const raw = pickupAtStr.trim();
      let pickupAt: string | null = null;
      if (raw.length > 0) {
        const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
        const d = new Date(normalized);
        if (!Number.isFinite(d.getTime())) {
          throw new Error(
            "Date/heure invalide (ex. 2026-05-15T10:00:00 ou avec fuseau Z)."
          );
        }
        pickupAt = d.toISOString();
      }
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
      Alert.alert("Impossible", marketplaceActionErrorMessage(e.message))
  });

  const handoverMutation = useMutation({
    mutationFn: () =>
      completeMarketplaceHandover(accessToken, listingId, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
      void qc.invalidateQueries({ queryKey: ["marketplaceListings"] });
      void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
      Alert.alert(
        "Retrait confirmé",
        "L’annonce est marquée comme vendue (hors paiement sur la plateforme)."
      );
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e.message))
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
        <ActivityIndicator size="large" color="#5d7a1f" />
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
  const canSubmitOffer =
    Boolean(myId) &&
    !isSeller &&
    L.status === "published";

  const isAcceptedBuyer =
    Boolean(myId && L.myOffers?.some((o) => o.status === "accepted"));
  const canEditPickup =
    L.status === "reserved" && (isSeller || isAcceptedBuyer);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.status}>
        Statut : {listingStatusLabel(L.status)}
      </Text>
      {L.status === "sold" ? (
        <Text style={styles.closedBanner}>
          Vente conclue — cette annonce est terminée.
        </Text>
      ) : null}
      {L.status === "cancelled" ? (
        <Text style={styles.closedBanner}>Cette annonce a été annulée.</Text>
      ) : null}
      {L.status === "reserved" ? (
        <Text style={styles.reservedBanner}>
          Accord conclu — l&apos;animal ou le lot est réservé. Convoyez le rendez-vous
          de retrait ci-dessous (paiement et livraison ne passent pas par
          l&apos;application pour l&apos;instant).
        </Text>
      ) : null}
      <Text style={styles.price}>
        {formatMoney(L.unitPrice, L.currency)}
        {L.quantity != null ? ` · ${L.quantity} unité(s)` : ""}
      </Text>
      {L.locationLabel ? (
        <Text style={styles.block}>Lieu : {L.locationLabel}</Text>
      ) : null}
      {L.description ? (
        <Text style={styles.desc}>{L.description}</Text>
      ) : (
        <Text style={styles.muted}>Pas de description.</Text>
      )}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vendeur</Text>
        <Text style={styles.block}>
          {L.seller.fullName || "—"}
          {L.seller.email ? ` · ${L.seller.email}` : ""}
        </Text>
      </View>
      {L.farm ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ferme</Text>
          <Text style={styles.block}>{L.farm.name}</Text>
        </View>
      ) : null}
      {L.animal ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Animal</Text>
          <Text style={styles.block}>
            ID {L.animal.publicId}
            {L.animal.tagCode ? ` · ${L.animal.tagCode}` : ""}
          </Text>
        </View>
      ) : null}

      {canEditPickup ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rendez-vous de retrait</Text>
          <Text style={styles.hintSmall}>
            Date/heure (ISO recommandé, ex. 2026-05-15T10:00:00) — vendeur et
            acheteur peuvent mettre à jour après accord.
          </Text>
          <TextInput
            style={styles.pickupInput}
            value={pickupAtStr}
            onChangeText={setPickupAtStr}
            placeholder="2026-05-15T10:00:00"
            autoCapitalize="none"
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

      {isSeller && L.status === "reserved" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Après le retrait physique</Text>
          <TouchableOpacity
            style={styles.handoverBtn}
            disabled={handoverMutation.isPending}
            onPress={() =>
              Alert.alert(
                "Confirmer le retrait ?",
                "L’annonce passera en « vendue ». Le paiement reste hors plateforme.",
                [
                  { text: "Annuler", style: "cancel" },
                  {
                    text: "Confirmer",
                    onPress: () => handoverMutation.mutate()
                  }
                ]
              )
            }
          >
            <Text style={styles.handoverBtnTxt}>
              {handoverMutation.isPending
                ? "Confirmation…"
                : "Confirmer que le retrait a eu lieu"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isSeller &&
      (L.status === "draft" || L.status === "published") ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestion vendeur</Text>
          {L.status === "draft" ? (
            <Text style={styles.sellerHint}>
              Brouillon : invisible sur le marché jusqu&apos;à publication.
            </Text>
          ) : null}
          {L.status === "draft" ? (
            <TouchableOpacity
              style={[
                styles.sellerBtnPrimary,
                publishMutation.isPending && styles.sellerBtnDisabled
              ]}
              disabled={
                publishMutation.isPending ||
                cancelMutation.isPending ||
                acceptMutation.isPending ||
                rejectMutation.isPending
              }
              onPress={() =>
                Alert.alert(
                  "Publier cette annonce ?",
                  "Elle sera visible par tous les acheteurs.",
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Publier",
                      onPress: () => publishMutation.mutate()
                    }
                  ]
                )
              }
            >
              <Text style={styles.sellerBtnPrimaryTxt}>
                {publishMutation.isPending ? "Publication…" : "Publier sur le marché"}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.sellerBtnSecondary}
            disabled={
              publishMutation.isPending ||
              cancelMutation.isPending ||
              acceptMutation.isPending ||
              rejectMutation.isPending
            }
            onPress={() =>
              navigation.navigate("EditMarketplaceListing", { listingId })
            }
          >
            <Text style={styles.sellerBtnSecondaryTxt}>Modifier le contenu</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sellerBtnDanger,
              cancelMutation.isPending && styles.sellerBtnDisabled
            ]}
            disabled={
              publishMutation.isPending ||
              cancelMutation.isPending ||
              acceptMutation.isPending ||
              rejectMutation.isPending
            }
            onPress={() =>
              Alert.alert(
                "Annuler cette annonce ?",
                "Les offres encore en attente seront refusées.",
                [
                  { text: "Retour", style: "cancel" },
                  {
                    text: "Annuler l’annonce",
                    style: "destructive",
                    onPress: () => cancelMutation.mutate()
                  }
                ]
              )
            }
          >
            <Text style={styles.sellerBtnDangerTxt}>
              {cancelMutation.isPending ? "Annulation…" : "Annuler l’annonce"}
            </Text>
          </TouchableOpacity>
        </View>
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
                    onPress={() =>
                      Alert.alert(
                        "Accepter cette offre ?",
                        "Les autres offres en attente seront refusées et l’annonce sera réservée pour cet acheteur. Tu pourrez ensuite fixer le rendez-vous de retrait (paiement hors application).",
                        [
                          { text: "Annuler", style: "cancel" },
                          {
                            text: "Accepter",
                            onPress: () => acceptMutation.mutate(o.id)
                          }
                        ]
                      )
                    }
                  >
                    <Text style={styles.btnAcceptTxt}>Accepter</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnReject}
                    onPress={() => rejectMutation.mutate(o.id)}
                  >
                    <Text style={styles.btnRejectTxt}>Refuser</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {!isSeller && L.myOffers && L.myOffers.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mes offres sur cette annonce</Text>
          {L.myOffers.map((o) => (
            <Text key={o.id} style={styles.block}>
              {formatMoney(o.offeredPrice, L.currency)} —{" "}
              {offerStatusLabel(o.status)}
            </Text>
          ))}
        </View>
      ) : null}

      {canSubmitOffer ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Faire une offre</Text>
          <Text style={styles.hint}>Prix proposé ({L.currency})</Text>
          <TextInput
            style={styles.input}
            value={offerPrice}
            onChangeText={setOfferPrice}
            placeholder="Ex. 150000"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
            editable={!offerMutation.isPending}
          />
          <Text style={styles.hint}>Quantité (optionnel)</Text>
          <TextInput
            style={styles.input}
            value={offerQty}
            onChangeText={setOfferQty}
            placeholder="Nombre d’animaux / unités"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            editable={!offerMutation.isPending}
          />
          <Text style={styles.hint}>Message (optionnel)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={offerMsg}
            onChangeText={setOfferMsg}
            placeholder="Précisions pour le vendeur…"
            placeholderTextColor="#999"
            multiline
            editable={!offerMutation.isPending}
          />
          <TouchableOpacity
            style={[
              styles.submit,
              offerMutation.isPending && styles.submitDisabled
            ]}
            onPress={() => offerMutation.mutate()}
            disabled={offerMutation.isPending}
          >
            <Text style={styles.submitText}>
              {offerMutation.isPending ? "Envoi…" : "Envoyer l’offre"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {isSeller && (!L.offers || L.offers.length === 0) ? (
        <Text style={styles.note}>
          C’est ton annonce. Les offres des acheteurs apparaîtront ici.
        </Text>
      ) : null}
      {!canSubmitOffer && !isSeller && L.status !== "published" ? (
        <Text style={styles.note}>
          Les offres ne sont possibles que pour une annonce publiée.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#f9f8ea"
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9f8ea"
  },
  error: {
    color: "#b00020",
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
    marginTop: 12
  },
  btnAccept: {
    flex: 1,
    marginRight: 8,
    backgroundColor: "#5d7a1f",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center"
  },
  btnAcceptTxt: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14
  },
  btnReject: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#b00020",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center"
  },
  btnRejectTxt: {
    color: "#b00020",
    fontWeight: "700",
    fontSize: 14
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
  }
});
