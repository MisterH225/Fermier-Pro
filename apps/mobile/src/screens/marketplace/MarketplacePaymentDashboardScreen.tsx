import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import {
  fetchMarketplaceTransactions,
  fetchMyMarketplaceOffers,
  fetchReceivedMarketplaceOffers
} from "../../lib/api";
import { formatMarketMoney } from "../../components/marketplace/MarketplaceListingCard";
import { TabSelector } from "../../components/tabs";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { buyerColors } from "../../theme/buyerTheme";
import type { RootStackParamList } from "../../types/navigation";

type ScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "MarketplacePaymentDashboard"
>;

const ACTIVE_ESCROW_STATUSES = [
  "PAYMENT_PENDING",
  "PAYMENT_HELD",
  "PICKUP_SCHEDULED",
  "SELLER_SHIPPED",
  "BUYER_RECEIVED",
  "WEIGHT_DECLARED",
  "WEIGHT_DISPUTED",
  "WEIGHT_VALIDATED",
  "DELIVERY_DISPUTED"
];

const HISTORICAL_TRANSACTION_STATUSES = [
  "CANCELLED_BY_BUYER",
  "CANCELLED_BY_SELLER",
  "CANCELLED_SOLD_TO_OTHER",
  "PAYMENT_FAILED",
  "OFFER_EXPIRED"
];

export function MarketplacePaymentDashboardScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ScreenNavigationProp>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId, authMe } = useSession();

  // Détection des rôles disponibles pour l'utilisateur
  const profiles = authMe?.profiles ?? [];
  const hasSellerProfile = profiles.some((p) => p.type === "producer");
  const hasBuyerProfile = profiles.some((p) => p.type === "buyer");
  const canSwitchRole = hasSellerProfile && hasBuyerProfile;

  // Rôle de départ (Acheteur s'il est acheteur actif, sinon Vendeur)
  const [role, setRole] = useState<"seller" | "buyer">(() => {
    const activeProfile = profiles.find((p) => p.id === activeProfileId);
    if (activeProfile?.type === "buyer") return "buyer";
    if (activeProfile?.type === "producer") return "seller";
    return hasBuyerProfile ? "buyer" : "seller";
  });

  const [activeTab, setActiveTab] = useState<"completed" | "active" | "history">("active");

  // Requêtes API
  const transactionsQ = useQuery({
    queryKey: ["marketplaceTransactions", activeProfileId],
    queryFn: () => fetchMarketplaceTransactions(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const sellerOffersQ = useQuery({
    queryKey: ["marketplaceOffersReceived", activeProfileId],
    queryFn: () => fetchReceivedMarketplaceOffers(accessToken!, activeProfileId),
    enabled: Boolean(accessToken && role === "seller")
  });

  const buyerOffersQ = useQuery({
    queryKey: ["marketplaceOffers", activeProfileId],
    queryFn: () => fetchMyMarketplaceOffers(accessToken!, activeProfileId),
    enabled: Boolean(accessToken && role === "buyer")
  });

  const isPending =
    transactionsQ.isPending ||
    (role === "seller" ? sellerOffersQ.isPending : buyerOffersQ.isPending);

  const isFetching =
    transactionsQ.isFetching ||
    (role === "seller" ? sellerOffersQ.isFetching : buyerOffersQ.isFetching);

  const hasError =
    transactionsQ.isError ||
    (role === "seller" ? sellerOffersQ.isError : buyerOffersQ.isError);

  const onRefresh = async () => {
    await Promise.all([
      transactionsQ.refetch(),
      role === "seller" ? sellerOffersQ.refetch() : buyerOffersQ.refetch()
    ]);
  };

  // Filtrage des données selon le rôle et l'onglet sélectionné
  const filteredData = useMemo(() => {
    const myId = authMe?.user.id;
    const allTx = transactionsQ.data ?? [];
    
    // Filtrer les transactions propres au rôle sélectionné
    const roleTx = allTx.filter((tx) =>
      role === "seller"
        ? tx.sellerUserId === myId
        : tx.buyerUserId === myId
    );

    let result: any[] = [];
    if (activeTab === "completed") {
      result = roleTx
        .filter((tx) => tx.status === "TRANSACTION_CLOSED")
        .map((tx) => ({ ...tx, type: "transaction" as const }));
    } else if (activeTab === "active") {
      result = roleTx
        .filter((tx) => ACTIVE_ESCROW_STATUSES.includes(tx.status))
        .map((tx) => ({ ...tx, type: "transaction" as const }));
    } else {
      // Onglet Historique & Négociations
      const cancelledTx = roleTx
        .filter((tx) => HISTORICAL_TRANSACTION_STATUSES.includes(tx.status))
        .map((tx) => ({ ...tx, type: "transaction" as const }));

      let pendingOffers: any[] = [];
      if (role === "seller") {
        pendingOffers = (sellerOffersQ.data ?? [])
          .filter((o) => ["pending", "countered"].includes(o.status))
          .map((o) => ({
            id: o.id,
            listingId: o.listing.id,
            title: o.listing.title,
            status: o.status,
            amount: Number(o.offeredPrice),
            currency: o.listing.currency || "XOF",
            date: o.createdAt,
            partnerName: o.buyer.fullName || t("paymentsDashboard.buyerLabel", { name: "" }),
            type: "offer" as const
          }));
      } else {
        pendingOffers = (buyerOffersQ.data ?? [])
          .filter((o) => ["pending", "countered"].includes(o.status))
          .map((o) => ({
            id: o.id,
            listingId: o.listing.id,
            title: o.listing.title,
            status: o.status,
            amount: Number(o.offeredPrice),
            currency: o.listing.currency || "XOF",
            date: o.createdAt,
            partnerName: o.listing.farm?.name || t("paymentsDashboard.sellerLabel", { name: "" }),
            type: "offer" as const
          }));
      }
      result = [...cancelledTx, ...pendingOffers];
    }

    // Tri par date décroissante (le plus récent en premier)
    return result.sort((a, b) => {
      const dateA = new Date(a.type === "transaction" ? a.createdAt : a.date).getTime();
      const dateB = new Date(b.type === "transaction" ? b.createdAt : b.date).getTime();
      return dateB - dateA;
    });
  }, [activeTab, role, transactionsQ.data, sellerOffersQ.data, buyerOffersQ.data, authMe, t]);

  const renderItem = ({ item }: { item: any }) => {
    const isTx = item.type === "transaction";
    const dateStr = new Date(isTx ? item.createdAt : item.date).toLocaleDateString("fr-FR");
    
    // Détermination du statut traduit
    let statusLabel = "";
    if (isTx) {
      statusLabel = t(`marketScreen.transaction.status.${item.status}`, {
        defaultValue: item.status
      });
    } else {
      statusLabel = t(`paymentsDashboard.status.${item.status}`, {
        defaultValue: item.status
      });
    }

    const price = isTx ? item.blockedAmount : item.amount;
    const cur = item.currency;

    return (
      <Pressable
        style={styles.itemCard}
        onPress={() => {
          if (isTx) {
            navigation.navigate("MarketplaceTransaction", {
              transactionId: item.id
            });
          } else {
            navigation.navigate("MarketplaceListingDetail", {
              listingId: item.listingId,
              headline: item.title
            });
          }
        }}
      >
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {isTx ? item.listingTitle : item.title}
          </Text>
          <Text style={styles.itemAmount}>{formatMarketMoney(Math.round(price), cur)}</Text>
        </View>

        <View style={styles.itemFooter}>
          <View style={styles.statusWrap}>
            <View
              style={[
                styles.statusDot,
                item.status === "TRANSACTION_CLOSED" && styles.dotClosed,
                ACTIVE_ESCROW_STATUSES.includes(item.status) && styles.dotActive,
                (HISTORICAL_TRANSACTION_STATUSES.includes(item.status) || ["rejected", "withdrawn"].includes(item.status)) && styles.dotCancelled
              ]}
            />
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
          
          <Text style={styles.itemDate}>{dateStr}</Text>
        </View>
        
        {item.partnerName ? (
          <Text style={styles.partnerText}>
            {role === "seller"
              ? `${t("paymentsDashboard.buyerLabel", { name: "" })} ${item.partnerName}`
              : `${t("paymentsDashboard.sellerLabel", { name: "" })} ${item.partnerName}`}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  const getEmptyStateMessage = () => {
    if (activeTab === "completed") {
      return role === "seller"
        ? t("paymentsDashboard.emptySold")
        : t("paymentsDashboard.emptyBought");
    }
    if (activeTab === "active") {
      return t("paymentsDashboard.emptyInProgress");
    }
    return t("paymentsDashboard.emptyHistory");
  };

  const dashboardColor = role === "buyer" ? buyerColors.primary : mobileColors.accent;

  const tabList = [
    {
      key: "active" as const,
      label: t("paymentsDashboard.tabInProgress"),
      content: null
    },
    {
      key: "completed" as const,
      label: role === "seller" ? t("paymentsDashboard.tabSold") : t("paymentsDashboard.tabBought"),
      content: null
    },
    {
      key: "history" as const,
      label: t("paymentsDashboard.tabHistory"),
      content: null
    }
  ];

  return (
    <View style={styles.root}>
      {/* Sélecteur de rôle en haut si l'utilisateur possède les deux profils */}
      {canSwitchRole ? (
        <View style={styles.roleHeader}>
          <Pressable
            style={[
              styles.roleButton,
              role === "seller" && { backgroundColor: mobileColors.accent }
            ]}
            onPress={() => setRole("seller")}
          >
            <Text style={[styles.roleButtonText, role === "seller" && styles.activeRoleText]}>
              {t("paymentsDashboard.roleSeller")}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.roleButton,
              role === "buyer" && { backgroundColor: buyerColors.primary }
            ]}
            onPress={() => setRole("buyer")}
          >
            <Text style={[styles.roleButtonText, role === "buyer" && styles.activeRoleText]}>
              {t("paymentsDashboard.roleBuyer")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.tabContainer}>
        <TabSelector
          activeTab={activeTab}
          onTabChange={(key) => setActiveTab(key as any)}
          tabs={tabList}
        />
      </View>

      {isPending && !isFetching ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={dashboardColor} />
        </View>
      ) : hasError && !isFetching ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={mobileColors.error} style={{ opacity: 0.8 }} />
          <Text style={[styles.emptyText, { color: mobileColors.error, marginTop: 10, paddingHorizontal: 20 }]}>
            {t("common.errors.generic")}
          </Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: dashboardColor }]}
            onPress={onRefresh}
          >
            <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: bottomInset + mobileSpacing.lg }]}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={onRefresh}
              tintColor={dashboardColor}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color={mobileColors.textSecondary} style={{ opacity: 0.5 }} />
              <Text style={styles.emptyText}>{getEmptyStateMessage()}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  roleHeader: {
    flexDirection: "row",
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm,
    backgroundColor: mobileColors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  roleButtonText: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  activeRoleText: {
    color: mobileColors.onAccent
  },
  tabContainer: {
    backgroundColor: mobileColors.background
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  list: {
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  itemCard: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    gap: 8
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  itemTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    flex: 1,
    marginRight: mobileSpacing.sm
  },
  itemAmount: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  statusWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: mobileColors.border
  },
  dotClosed: {
    backgroundColor: mobileColors.success
  },
  dotActive: {
    backgroundColor: mobileColors.accent
  },
  dotCancelled: {
    backgroundColor: mobileColors.error
  },
  statusText: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  itemDate: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  partnerText: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontSize: 12,
    marginTop: 2
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12
  },
  emptyText: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  retryButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  retryButtonText: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.onAccent
  }
});
