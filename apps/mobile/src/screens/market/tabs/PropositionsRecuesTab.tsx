import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CounterProposalModal } from "../../../components/marketplace/CounterProposalModal";
import { ProposalCard } from "../../../components/marketplace/ProposalCard";
import { EmptyStateCard } from "../../../components/common/EmptyStateCard";
import { useModal } from "../../../components/modals/useModal";
import { useSession } from "../../../context/SessionContext";
import {
  acceptMarketplaceOffer,
  counterMarketplaceOffer,
  ensureDirectChatRoom,
  fetchMarketplaceListing,
  fetchReceivedMarketplaceOffers,
  rejectMarketplaceOffer,
  type MarketplaceOfferBrief,
  type MarketplaceOfferReceivedRow
} from "../../../lib/api";
import { marketplaceActionErrorMessage } from "../../../lib/marketplaceLabels";
import { getUserFacingError } from "../../../lib/userFacingError";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import type { RootStackParamList } from "../../../types/navigation";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  farmId?: string | null;
  listingIdFilter?: string | null;
  contentPaddingBottom: number;
};

type ListingGroup = {
  listingId: string;
  listingTitle: string;
  offers: MarketplaceOfferReceivedRow[];
};

export function PropositionsRecuesTab({
  navigation,
  farmId,
  listingIdFilter,
  contentPaddingBottom
}: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const { open } = useModal();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [counterOffer, setCounterOffer] = useState<MarketplaceOfferReceivedRow | null>(
    null
  );
  const [activeListingId, setActiveListingId] = useState<string | null>(null);

  const receivedQ = useQuery({
    queryKey: ["marketplaceOffersReceived", activeProfileId, farmId],
    queryFn: () =>
      fetchReceivedMarketplaceOffers(accessToken!, activeProfileId, farmId),
    enabled: Boolean(accessToken)
  });

  const listingDetailQ = useQuery({
    queryKey: ["marketplaceListing", activeListingId, activeProfileId],
    queryFn: () =>
      fetchMarketplaceListing(accessToken!, activeListingId!, activeProfileId),
    enabled: Boolean(accessToken && activeListingId)
  });

  const rows = useMemo(() => {
    const all = receivedQ.data ?? [];
    if (!listingIdFilter) return all;
    return all.filter((r) => r.listing.id === listingIdFilter);
  }, [receivedQ.data, listingIdFilter]);

  const groups = useMemo((): ListingGroup[] => {
    const map = new Map<string, ListingGroup>();
    for (const row of rows) {
      const existing = map.get(row.listing.id);
      if (existing) {
        existing.offers.push(row);
      } else {
        map.set(row.listing.id, {
          listingId: row.listing.id,
          listingTitle: row.listing.title,
          offers: [row]
        });
      }
    }
    return Array.from(map.values());
  }, [rows]);

  const invalidateAll = (listingId: string) => {
    void qc.invalidateQueries({ queryKey: ["marketplaceOffersReceived"] });
    void qc.invalidateQueries({ queryKey: ["marketplaceOffersCounts"] });
    void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
    void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
    void qc.invalidateQueries({ queryKey: ["marketplaceListings"] });
  };

  const acceptMut = useMutation({
    mutationFn: (row: MarketplaceOfferReceivedRow) =>
      acceptMarketplaceOffer(
        accessToken!,
        row.listing.id,
        row.id,
        activeProfileId
      ),
    onSuccess: (_data, row) => {
      invalidateAll(row.listing.id);
      open("success", {
        title: t("marketScreen.acceptSuccessTitle"),
        message: t("marketScreen.acceptSuccessBody"),
        autoDismissMs: 2200
      });
    },
    onError: (e: Error) =>
      Alert.alert(
        t("common.error"),
        marketplaceActionErrorMessage(e, t)
      )
  });

  const rejectMut = useMutation({
    mutationFn: (row: MarketplaceOfferReceivedRow) =>
      rejectMarketplaceOffer(
        accessToken!,
        row.listing.id,
        row.id,
        activeProfileId
      ),
    onSuccess: (_data, row) => {
      invalidateAll(row.listing.id);
      open("success", {
        message: t("marketScreen.offerRejectSuccess"),
        autoDismissMs: 2000
      });
    },
    onError: (e: Error) =>
      Alert.alert(
        t("common.error"),
        marketplaceActionErrorMessage(e, t)
      )
  });

  const counterMut = useMutation({
    mutationFn: (input: {
      row: MarketplaceOfferReceivedRow;
      counterPricePerKg?: number;
      counterOfferedPrice?: number;
    }) =>
      counterMarketplaceOffer(
        accessToken!,
        input.row.listing.id,
        input.row.id,
        {
          ...(input.counterOfferedPrice != null
            ? { counterOfferedPrice: input.counterOfferedPrice }
            : { counterPricePerKg: input.counterPricePerKg })
        },
        activeProfileId
      ),
    onSuccess: (_data, input) => {
      setCounterOffer(null);
      invalidateAll(input.row.listing.id);
      open("success", {
        message: t("marketScreen.counterModal.success"),
        autoDismissMs: 2000
      });
    },
    onError: (e: Error) =>
      Alert.alert(
        t("common.error"),
        marketplaceActionErrorMessage(e, t)
      )
  });

  const chatMut = useMutation({
    mutationFn: (row: MarketplaceOfferReceivedRow) =>
      ensureDirectChatRoom(
        accessToken!,
        row.buyer.id,
        activeProfileId,
        row.listing.id
      ),
    onSuccess: (room, row) => {
      navigation.navigate("ChatRoom", {
        roomId: room.id,
        headline: room.title?.trim() || t("marketScreen.detail.chatTitle"),
        listingId: row.listing.id
      });
    },
    onError: (e: Error) =>
      Alert.alert(
        t("marketScreen.detail.contactErrorTitle"),
        getUserFacingError(e, t)
      )
  });

  const busy =
    acceptMut.isPending ||
    rejectMut.isPending ||
    counterMut.isPending ||
    chatMut.isPending;

  const toggleGroup = (listingId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [listingId]: !(prev[listingId] ?? true)
    }));
  };

  const toOfferBrief = (row: MarketplaceOfferReceivedRow): MarketplaceOfferBrief => ({
    id: row.id,
    listingId: row.listing.id,
    buyerUserId: row.buyer.id,
    offeredPrice: row.offeredPrice,
    proposedPricePerKg: row.proposedPricePerKg,
    counterPricePerKg: row.counterPricePerKg,
    quantity: row.quantity,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt,
    buyer: row.buyer
  });

  if (receivedQ.isPending && !receivedQ.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  const err =
    receivedQ.error instanceof Error
      ? getUserFacingError(receivedQ.error, t)
      : receivedQ.error
        ? String(receivedQ.error)
        : null;

  if (err) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err}</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={groups}
        keyExtractor={(g) => g.listingId}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: contentPaddingBottom }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={receivedQ.isFetching}
            onRefresh={() => void receivedQ.refetch()}
            tintColor={mobileColors.accent}
          />
        }
        ListEmptyComponent={
          <EmptyStateCard
            title={t("marketScreen.proposals.emptyReceivedTitle")}
            subtitle={t("marketScreen.proposals.emptyReceivedBody")}
          />
        }
        renderItem={({ item: group }) => {
          const isOpen = expanded[group.listingId] ?? true;
          return (
            <View style={styles.group}>
              <Pressable
                style={styles.groupHeader}
                onPress={() => toggleGroup(group.listingId)}
              >
                <Text style={styles.groupTitle} numberOfLines={2}>
                  {group.listingTitle}
                </Text>
                <Text style={styles.groupCount}>
                  {t("marketScreen.proposals.groupCount", {
                    count: group.offers.length
                  })}
                </Text>
                <Ionicons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={mobileColors.textSecondary}
                />
              </Pressable>
              {isOpen
                ? group.offers.map((row) => (
                    <ProposalCard
                      key={row.id}
                      variant="received"
                      id={row.id}
                      buyerName={row.buyer.fullName}
                      offeredPrice={row.offeredPrice}
                      quantity={row.quantity}
                      message={row.message}
                      status={row.status}
                      createdAt={row.createdAt}
                      currency={row.listing.currency}
                      listingTitle={row.listing.title}
                      listingCategory={row.listing.category}
                      listingWeightKg={row.listing.totalWeightKg}
                      actionsDisabled={busy}
                      onPressListing={() =>
                        navigation.navigate("MarketplaceListingDetail", {
                          listingId: row.listing.id,
                          headline: row.listing.title
                        })
                      }
                      onAccept={() => acceptMut.mutate(row)}
                      onReject={() => rejectMut.mutate(row)}
                      onCounter={() => {
                        setCounterOffer(row);
                        setActiveListingId(row.listing.id);
                      }}
                      onNegotiate={() => chatMut.mutate(row)}
                    />
                  ))
                : null}
            </View>
          );
        }}
      />

      <CounterProposalModal
        visible={Boolean(counterOffer)}
        listing={listingDetailQ.data ?? null}
        offer={counterOffer ? toOfferBrief(counterOffer) : null}
        onClose={() => {
          setCounterOffer(null);
          setActiveListingId(null);
        }}
        submitting={counterMut.isPending}
        onSubmit={(payload) => {
          if (!counterOffer) return;
          counterMut.mutate({
            row: counterOffer,
            counterPricePerKg: payload.counterPricePerKg,
            counterOfferedPrice: payload.counterOfferedPrice
          });
        }}
      />

    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: mobileSpacing.lg
  },
  error: {
    ...mobileTypography.body,
    color: mobileColors.error,
    textAlign: "center"
  },
  list: {
    padding: mobileSpacing.md,
    gap: mobileSpacing.md
  },
  group: {
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.md
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.xs
  },
  groupTitle: {
    ...mobileTypography.cardTitle,
    flex: 1,
    color: mobileColors.textPrimary
  },
  groupCount: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  }
});
