import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { CreditBalancePaymentModal } from "../../../components/buyer/CreditBalancePaymentModal";
import type { MarketplacePaymentMethodChoice } from "../../../components/buyer/MarketplacePaymentMethodPicker";
import { parseMarketNum } from "../../../components/marketplace/MarketplaceListingCard";
import { ProposalCard } from "../../../components/marketplace/ProposalCard";
import { EmptyStateCard } from "../../../components/common/EmptyStateCard";
import { useModal } from "../../../components/modals/useModal";
import { useSession } from "../../../context/SessionContext";
import { invalidateBuyerDashboardQueries } from "../../../lib/buyerDashboardQueries";
import {
  acceptMarketplaceOfferCounter,
  agreeMarketplaceCreditOffer,
  confirmMarketplaceCreditBalancePayment,
  initiateMarketplaceCreditBalancePayment,
  ensureDirectChatRoom,
  fetchBuyerWallet,
  fetchMarketplaceTransaction,
  fetchMyMarketplaceOffers,
  withdrawMarketplaceOffer,
  type MarketplaceOfferMineRow
} from "../../../lib/api";
import { marketplaceActionErrorMessage } from "../../../lib/marketplaceLabels";
import { openPaymentCheckout } from "../../../lib/paymentCheckout";
import { getUserFacingError } from "../../../lib/userFacingError";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import type { RootStackParamList } from "../../../types/navigation";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  listingIdFilter?: string | null;
  highlightOfferId?: string;
  contentPaddingBottom: number;
};

export function PropositionsEnvoyeesTab({
  navigation,
  listingIdFilter,
  highlightOfferId,
  contentPaddingBottom
}: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const { open } = useModal();
  const listRef = useRef<FlatList<MarketplaceOfferMineRow>>(null);
  const [highlightOffer, setHighlightOffer] = useState(highlightOfferId ?? null);
  const [balancePayOffer, setBalancePayOffer] =
    useState<MarketplaceOfferMineRow | null>(null);

  const sentQ = useQuery({
    queryKey: ["marketplaceMyOffers", activeProfileId],
    queryFn: () => fetchMyMarketplaceOffers(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const walletQ = useQuery({
    queryKey: ["buyerWallet", activeProfileId],
    queryFn: () => fetchBuyerWallet(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const invalidateAll = (listingId: string) => {
    void qc.invalidateQueries({ queryKey: ["marketplaceMyOffers"] });
    void qc.invalidateQueries({ queryKey: ["marketplaceOffersCounts"] });
    void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
    void qc.invalidateQueries({ queryKey: ["marketplaceTransactions"] });
    void qc.invalidateQueries({ queryKey: ["buyerWallet"] });
    void qc.invalidateQueries({ queryKey: ["buyerWalletEntries"] });
    invalidateBuyerDashboardQueries(qc);
  };

  const openCreditTransaction = async (row: MarketplaceOfferMineRow) => {
    const txId = row.transaction?.id;
    if (!txId) {
      Alert.alert(
        t("common.error"),
        t("marketScreen.credit.escrow.transactionMissing")
      );
      return;
    }
    try {
      const fresh = await fetchMarketplaceTransaction(
        accessToken!,
        txId,
        activeProfileId
      );
      if (fresh.status === "PAYMENT_HELD") {
        Alert.alert(
          t("marketScreen.transaction.paymentAlreadyHeldTitle"),
          t("marketScreen.transaction.paymentAlreadyHeldBody")
        );
        navigation.navigate("MarketplaceTransaction", { transactionId: txId });
        return;
      }
      if (fresh.status !== "PAYMENT_PENDING" && fresh.status !== "PAYMENT_FAILED") {
        Alert.alert(
          t("marketScreen.transaction.paymentErrorTitle"),
          t("marketScreen.transaction.paymentInvalidStatus", {
            status: fresh.status
          })
        );
        navigation.navigate("MarketplaceTransaction", { transactionId: txId });
        return;
      }
    } catch (e: unknown) {
      Alert.alert(t("common.error"), marketplaceActionErrorMessage(e, t));
      return;
    }
    navigation.navigate("MarketplaceTransaction", { transactionId: txId });
  };

  const withdrawMut = useMutation({
    mutationFn: (row: MarketplaceOfferMineRow) =>
      withdrawMarketplaceOffer(accessToken!, row.id, activeProfileId),
    onSuccess: (_data, row) => {
      invalidateAll(row.listing.id);
      void qc.invalidateQueries({ queryKey: ["chatRooms", activeProfileId] });
      open("success", {
        message: t("marketScreen.proposals.withdrawSuccess"),
        autoDismissMs: 2000
      });
    },
    onError: (e: Error) =>
      Alert.alert(
        t("marketScreen.withdrawTitle"),
        marketplaceActionErrorMessage(e, t)
      )
  });

  const acceptCounterMut = useMutation({
    mutationFn: async (row: MarketplaceOfferMineRow) => {
      if (row.offerType === "credit") {
        const data = await agreeMarketplaceCreditOffer(
          accessToken!,
          row.listing.id,
          row.id,
          activeProfileId
        );
        return {
          credit: true as const,
          transactionId: data.transactionId ?? undefined
        };
      }
      const data = await acceptMarketplaceOfferCounter(
        accessToken!,
        row.listing.id,
        row.id,
        activeProfileId
      );
      return { credit: false as const, transactionId: data.transactionId };
    },
    onSuccess: (data, row) => {
      invalidateAll(row.listing.id);
      open("success", {
        message: data.credit
          ? t("marketScreen.credit.agreedSuccess")
          : t("marketScreen.counterModal.accepted"),
        autoDismissMs: 2000
      });
      if (data.transactionId) {
        navigation.navigate("MarketplaceTransaction", {
          transactionId: data.transactionId
        });
      }
    },
    onError: (e: Error) =>
      Alert.alert(
        t("common.error"),
        marketplaceActionErrorMessage(e, t)
      )
  });

  const payBalanceMut = useMutation({
    mutationFn: async ({
      row,
      paymentMethod
    }: {
      row: MarketplaceOfferMineRow;
      paymentMethod: MarketplacePaymentMethodChoice;
    }) => {
      const init = await initiateMarketplaceCreditBalancePayment(
        accessToken!,
        row.id,
        activeProfileId,
        paymentMethod
      );
      if (paymentMethod === "mobile_money") {
        const checkoutUrl = init.paymentUrl?.trim();
        if (!checkoutUrl) {
          throw new Error("MARKETPLACE_CHECKOUT_URL_MISSING");
        }
        await openPaymentCheckout(checkoutUrl);
        return;
      }
      await confirmMarketplaceCreditBalancePayment(
        accessToken!,
        row.id,
        init.providerRef,
        activeProfileId
      );
    },
    onSuccess: (_data, { row, paymentMethod }) => {
      setBalancePayOffer(null);
      invalidateAll(row.listing.id);
      if (paymentMethod === "mobile_money") {
        Alert.alert(
          t("marketScreen.transaction.paymentPendingTitle"),
          t("marketScreen.transaction.paymentPendingBody")
        );
        return;
      }
      open("success", {
        message: t("marketScreen.credit.balance.declaredSuccess"),
        autoDismissMs: 2000
      });
    },
    onError: (e: Error) =>
      Alert.alert(t("common.error"), marketplaceActionErrorMessage(e, t))
  });

  const contactSellerMut = useMutation({
    mutationFn: (row: MarketplaceOfferMineRow) =>
      ensureDirectChatRoom(
        accessToken!,
        row.listing.seller.id,
        activeProfileId,
        row.listing.id
      ),
    onSuccess: (room, row) => {
      void qc.invalidateQueries({ queryKey: ["chatRooms", activeProfileId] });
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

  const rows = useMemo(() => {
    const all = sentQ.data ?? [];
    if (!listingIdFilter) return all;
    return all.filter((r) => r.listing.id === listingIdFilter);
  }, [sentQ.data, listingIdFilter]);

  useEffect(() => {
    setHighlightOffer(highlightOfferId ?? null);
  }, [highlightOfferId]);

  useEffect(() => {
    if (!highlightOfferId || rows.length === 0) {
      return;
    }
    const index = rows.findIndex((r) => r.id === highlightOfferId);
    if (index >= 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.2
        });
      });
    }
    const timer = setTimeout(() => setHighlightOffer(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightOfferId, rows]);

  const confirmWithdraw = (row: MarketplaceOfferMineRow) => {
    Alert.alert(t("marketScreen.withdrawTitle"), t("marketScreen.withdrawBody"), [
      { text: t("marketScreen.withdrawCancel"), style: "cancel" },
      {
        text: t("marketScreen.withdrawConfirm"),
        style: "destructive",
        onPress: () => withdrawMut.mutate(row)
      }
    ]);
  };

  if (sentQ.isPending && !sentQ.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  const err =
    sentQ.error instanceof Error
      ? getUserFacingError(sentQ.error, t)
      : sentQ.error
        ? String(sentQ.error)
        : null;

  if (err) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err}</Text>
      </View>
    );
  }

  const busy =
    withdrawMut.isPending ||
    acceptCounterMut.isPending ||
    payBalanceMut.isPending ||
    contactSellerMut.isPending;

  const balancePayAmount = balancePayOffer
    ? parseMarketNum(balancePayOffer.balanceAmount) ?? 0
    : 0;
  const balancePayCurrency = balancePayOffer?.listing.currency ?? "XOF";

  return (
    <>
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.list,
        { paddingBottom: contentPaddingBottom }
      ]}
      onScrollToIndexFailed={() => {
        /* ligne pas encore mesurée */
      }}
      refreshControl={
        <RefreshControl
          refreshing={sentQ.isFetching}
          onRefresh={() => void sentQ.refetch()}
          tintColor={mobileColors.accent}
        />
      }
      ListEmptyComponent={
        <EmptyStateCard
          title={t("marketScreen.proposals.emptySentTitle")}
          subtitle={t("marketScreen.proposals.emptySentBody")}
        />
      }
      renderItem={({ item }) => (
        <ProposalCard
          variant="sent"
          highlighted={highlightOffer === item.id}
          id={item.id}
          offeredPrice={item.offeredPrice}
          quantity={item.quantity}
          message={item.message}
          status={item.status}
          createdAt={item.createdAt}
          currency={item.listing.currency}
          listingTitle={item.listing.title}
          offerType={item.offerType}
          advancePercentage={item.advancePercentage}
          advanceAmount={item.advanceAmount}
          balanceAmount={item.balanceAmount}
          balanceDueDays={item.balanceDueDays}
          balanceDueAt={item.balanceDueAt}
          advancePaidDeclaredAt={item.advancePaidDeclaredAt}
          advanceConfirmedAt={item.advanceConfirmedAt}
          balancePaidDeclaredAt={item.balancePaidDeclaredAt}
          transactionStatus={item.transaction?.status ?? null}
          listingCategory={null}
          sellerName={
            item.listing.seller.fullName ??
            item.listing.farm?.name ??
            null
          }
          subtitle={item.listing.farm?.name ?? undefined}
          actionsDisabled={busy}
          listingShare={{
            id: item.listing.id,
            title: item.listing.title,
            currency: item.listing.currency,
            farm: item.listing.farm
          }}
          navigation={navigation}
          withdrawLoading={withdrawMut.isPending}
          acceptCounterLoading={acceptCounterMut.isPending}
          onPressListing={() =>
            navigation.navigate("MarketplaceListingDetail", {
              listingId: item.listing.id,
              headline: item.listing.title
            })
          }
          onWithdraw={() => confirmWithdraw(item)}
          onAcceptCounter={() => acceptCounterMut.mutate(item)}
          onDeclareAdvance={() => openCreditTransaction(item)}
          onDeclareBalance={() => setBalancePayOffer(item)}
          onContactSeller={() => contactSellerMut.mutate(item)}
        />
      )}
    />
    <CreditBalancePaymentModal
      visible={balancePayOffer != null}
      onClose={() => {
        if (!payBalanceMut.isPending) {
          setBalancePayOffer(null);
        }
      }}
      amount={balancePayAmount}
      currency={balancePayCurrency}
      walletBalance={walletQ.data?.balance ?? 0}
      loading={payBalanceMut.isPending}
      onConfirm={(paymentMethod) => {
        if (balancePayOffer) {
          payBalanceMut.mutate({ row: balancePayOffer, paymentMethod });
        }
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
  }
});
