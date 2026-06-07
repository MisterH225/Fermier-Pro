import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { ConfirmAdvancePaymentModal } from "../../../components/marketplace/ConfirmAdvancePaymentModal";
import { ConfirmBalancePaymentModal } from "../../../components/marketplace/ConfirmBalancePaymentModal";
import { parseMarketNum } from "../../../components/marketplace/MarketplaceListingCard";
import { ProposalCard } from "../../../components/marketplace/ProposalCard";
import { EmptyStateCard } from "../../../components/common/EmptyStateCard";
import { useModal } from "../../../components/modals/useModal";
import { useSession } from "../../../context/SessionContext";
import {
  acceptMarketplaceOfferCounter,
  agreeMarketplaceCreditOffer,
  declareMarketplaceAdvancePaid,
  declareMarketplaceBalancePaid,
  fetchMyMarketplaceOffers,
  withdrawMarketplaceOffer,
  type MarketplaceOfferMineRow
} from "../../../lib/api";
import { marketplaceActionErrorMessage } from "../../../lib/marketplaceLabels";
import { getUserFacingError } from "../../../lib/userFacingError";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import type { RootStackParamList } from "../../../types/navigation";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  contentPaddingBottom: number;
};

export function PropositionsEnvoyeesTab({
  navigation,
  contentPaddingBottom
}: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const { open } = useModal();

  const [advanceOffer, setAdvanceOffer] = useState<MarketplaceOfferMineRow | null>(
    null
  );
  const [balanceOffer, setBalanceOffer] = useState<MarketplaceOfferMineRow | null>(
    null
  );

  const sentQ = useQuery({
    queryKey: ["marketplaceMyOffers", activeProfileId],
    queryFn: () => fetchMyMarketplaceOffers(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const invalidateAll = (listingId: string) => {
    void qc.invalidateQueries({ queryKey: ["marketplaceMyOffers"] });
    void qc.invalidateQueries({ queryKey: ["marketplaceOffersCounts"] });
    void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
  };

  const withdrawMut = useMutation({
    mutationFn: (row: MarketplaceOfferMineRow) =>
      withdrawMarketplaceOffer(accessToken!, row.id, activeProfileId),
    onSuccess: (_data, row) => {
      invalidateAll(row.listing.id);
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
        await agreeMarketplaceCreditOffer(
          accessToken!,
          row.listing.id,
          row.id,
          activeProfileId
        );
        return { credit: true as const, transactionId: undefined };
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

  const declareAdvanceMut = useMutation({
    mutationFn: (input: {
      row: MarketplaceOfferMineRow;
      paymentMode: string;
      paymentRef?: string;
    }) =>
      declareMarketplaceAdvancePaid(
        accessToken!,
        input.row.id,
        {
          paymentMode: input.paymentMode,
          paymentRef: input.paymentRef
        },
        activeProfileId
      ),
    onSuccess: (_data, input) => {
      setAdvanceOffer(null);
      invalidateAll(input.row.listing.id);
      open("success", {
        message: t("marketScreen.credit.advance.declaredSuccess"),
        autoDismissMs: 2000
      });
    },
    onError: (e: Error) =>
      Alert.alert(t("common.error"), marketplaceActionErrorMessage(e, t))
  });

  const declareBalanceMut = useMutation({
    mutationFn: (input: {
      row: MarketplaceOfferMineRow;
      amount: number;
      paymentMode: string;
      paymentRef?: string;
    }) =>
      declareMarketplaceBalancePaid(
        accessToken!,
        input.row.id,
        {
          amount: input.amount,
          paymentMode: input.paymentMode,
          paymentRef: input.paymentRef
        },
        activeProfileId
      ),
    onSuccess: (_data, input) => {
      setBalanceOffer(null);
      invalidateAll(input.row.listing.id);
      open("success", {
        message: t("marketScreen.credit.balance.declaredSuccess"),
        autoDismissMs: 2000
      });
    },
    onError: (e: Error) =>
      Alert.alert(t("common.error"), marketplaceActionErrorMessage(e, t))
  });

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

  const rows = sentQ.data ?? [];
  const busy =
    withdrawMut.isPending ||
    acceptCounterMut.isPending ||
    declareAdvanceMut.isPending ||
    declareBalanceMut.isPending;

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: contentPaddingBottom }
        ]}
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
            listingCategory={null}
            sellerName={
              item.listing.seller.fullName ??
              item.listing.farm?.name ??
              null
            }
            subtitle={item.listing.farm?.name ?? undefined}
            actionsDisabled={busy}
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
            onDeclareAdvance={() => setAdvanceOffer(item)}
            onDeclareBalance={() => setBalanceOffer(item)}
          />
        )}
      />

      <ConfirmAdvancePaymentModal
        visible={Boolean(advanceOffer)}
        advanceAmount={parseMarketNum(advanceOffer?.advanceAmount) ?? 0}
        balanceAmount={parseMarketNum(advanceOffer?.balanceAmount) ?? 0}
        balanceDueDays={advanceOffer?.balanceDueDays ?? 2}
        currency={advanceOffer?.listing.currency ?? "XOF"}
        submitting={declareAdvanceMut.isPending}
        onClose={() => setAdvanceOffer(null)}
        onConfirm={(payload) => {
          if (!advanceOffer) return;
          declareAdvanceMut.mutate({ row: advanceOffer, ...payload });
        }}
      />

      <ConfirmBalancePaymentModal
        visible={Boolean(balanceOffer)}
        balanceAmount={parseMarketNum(balanceOffer?.balanceAmount) ?? 0}
        currency={balanceOffer?.listing.currency ?? "XOF"}
        submitting={declareBalanceMut.isPending}
        onClose={() => setBalanceOffer(null)}
        onConfirm={(payload) => {
          if (!balanceOffer) return;
          declareBalanceMut.mutate({ row: balanceOffer, ...payload });
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
