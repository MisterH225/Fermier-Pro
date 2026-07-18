import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { MarketplaceTransactionDto } from "../../../lib/api";
import {
  marketplaceStatusUi,
  marketplaceTransactionReference
} from "../../../lib/marketplaceOrderStatusUi";
import {
  DeadlineNotice,
  OrderActivityFeed,
  OrderContactCard,
  OrderInfoCard,
  OrderStatusBadge,
  OrderTrackingStepper
} from "../../orders";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

type Props = {
  transaction: MarketplaceTransactionDto;
  role: "buyer" | "seller";
  amount: string;
  agreedPrice: string;
  agreedWeight: string;
  declaredWeight: string;
  onMessage: () => void;
  messageBusy?: boolean;
};

function escrowLabel(status: string, isCredit?: boolean): string {
  if (status === "PAYMENT_HELD") return "Paiement séquestré";
  if (status === "TRANSACTION_CLOSED") return "Paiement libéré";
  if (status.startsWith("CANCELLED") || status === "OFFER_EXPIRED") {
    return "Séquestre annulé";
  }
  if (status === "PAYMENT_FAILED") return "Paiement échoué";
  return isCredit ? "Paiement à crédit" : "Séquestre en attente";
}

function paymentMethodLabel(isCredit?: boolean): string {
  return isCredit ? "Crédit" : "Portefeuille ou Mobile Money";
}

function activityEvents(transaction: MarketplaceTransactionDto) {
  const events: Array<{
    at: string;
    label: string;
    tone: "pending" | "active" | "success" | "danger" | "neutral";
  }> = [];

  if (transaction.pickupDate) {
    events.push({
      at: transaction.pickupDate,
      label: `Rendez-vous de récupération prévu${
        transaction.pickupLocation ? ` — ${transaction.pickupLocation}` : ""
      }`,
      tone: "active"
    });
  }
  if (transaction.sellerWeightDeclaredAt) {
    events.push({
      at: transaction.sellerWeightDeclaredAt,
      label:
        transaction.sellerDeclaredWeightKg != null
          ? `Poids déclaré par le vendeur : ${transaction.sellerDeclaredWeightKg.toLocaleString(
              "fr-FR",
              { maximumFractionDigits: 1 }
            )} kg`
          : "Poids déclaré par le vendeur",
      tone:
        transaction.status === "WEIGHT_DISPUTED" ? "danger" : "pending"
    });
  }
  if (transaction.sellerShippedAt) {
    events.push({
      at: transaction.sellerShippedAt,
      label: "Remise confirmée par le vendeur",
      tone:
        transaction.status === "DELIVERY_DISPUTED" ? "danger" : "active"
    });
  }
  if (transaction.buyerReceivedAt) {
    events.push({
      at: transaction.buyerReceivedAt,
      label: "Réception confirmée par l’acheteur",
      tone: "success"
    });
  }
  if (transaction.receipt?.generatedAt) {
    events.push({
      at: transaction.receipt.generatedAt,
      label: `Transaction clôturée — reçu ${transaction.receipt.receiptNumber}`,
      tone: "success"
    });
  }

  return events.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

export function MarketplaceTransactionOverview({
  transaction,
  role,
  amount,
  agreedPrice,
  agreedWeight,
  declaredWeight,
  onMessage,
  messageBusy
}: Props) {
  const { t } = useTranslation();
  const ui = marketplaceStatusUi(transaction.status);
  const reference = marketplaceTransactionReference(transaction.id);
  const deadlineAt = transaction.deadlineAt ?? null;
  const counterparty =
    role === "buyer"
      ? t("marketScreen.transaction.counterpartySeller")
      : t("marketScreen.transaction.counterpartyBuyer");
  const steps = [
    {
      key: "order",
      labelKey: "marketScreen.transaction.stepOrder",
      icon: "receipt-outline" as const
    },
    {
      key: "payment",
      labelKey: "marketScreen.transaction.stepPayment",
      icon: "card-outline" as const
    },
    {
      key: "delivery",
      labelKey: "marketScreen.transaction.stepDelivery",
      icon: "car-outline" as const,
      timestamp: transaction.sellerShippedAt
    },
    {
      key: "receipt_weighing",
      labelKey: "marketScreen.transaction.stepReceiptWeighing",
      icon: "scale-outline" as const,
      timestamp: transaction.buyerReceivedAt
    },
    {
      key: "closed",
      labelKey: "marketScreen.transaction.stepClosed",
      icon: "checkmark-circle-outline" as const,
      timestamp: transaction.receipt?.generatedAt
    }
  ];

  const copyReference = async () => {
    await Clipboard.setStringAsync(reference);
    Alert.alert(t("marketScreen.transaction.referenceCopied"));
  };

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="cube-outline" size={20} color={mobileColors.accent} />
          </View>
          <View style={styles.referenceBlock}>
            <Text style={styles.referenceLabel}>
              {t("marketScreen.transaction.reference")}
            </Text>
            <View style={styles.referenceRow}>
              <Text style={styles.reference} numberOfLines={1}>
                {reference}
              </Text>
              <Pressable
                onPress={() => void copyReference()}
                accessibilityRole="button"
                accessibilityLabel={t("marketScreen.transaction.copyReference")}
                hitSlop={8}
              >
                <Ionicons
                  name="copy-outline"
                  size={16}
                  color={mobileColors.textSecondary}
                />
              </Pressable>
            </View>
          </View>
        </View>
        <OrderStatusBadge labelKey={ui.labelKey} tone={ui.tone} />
      </View>

      {deadlineAt ? (
        <View style={styles.deadline}>
          <DeadlineNotice
            deadlineAt={deadlineAt}
            outcomeKey={transaction.timeoutOutcomeKey}
          />
        </View>
      ) : null}

      <View style={styles.card}>
        <OrderTrackingStepper
          steps={steps}
          activeIndex={ui.stageIndex}
          disputedIndex={ui.disputedIndex}
          completedThroughIndex={
            ui.stage === "closed" ? 4 : Math.max(-1, ui.stageIndex - 1)
          }
        />
      </View>

      <OrderInfoCard
        titleKey="marketScreen.transaction.saleDetails"
        icon="document-text-outline"
        rows={[
          {
            labelKey: "marketScreen.transaction.counterparty",
            value: counterparty
          },
          {
            labelKey: "marketScreen.transaction.item",
            value:
              transaction.listingTitle ??
              t("marketScreen.transaction.listingFallback")
          },
          {
            labelKey: "marketScreen.transaction.agreedWeight",
            value: agreedWeight
          },
          {
            labelKey: "marketScreen.transaction.declaredWeight",
            value: declaredWeight
          },
          {
            labelKey: "marketScreen.transaction.agreedAmount",
            value: agreedPrice
          },
          {
            labelKey: "marketScreen.transaction.currentAmount",
            value: amount
          },
          {
            labelKey: "marketScreen.transaction.paymentMethod",
            value: paymentMethodLabel(transaction.isCredit)
          },
          {
            labelKey: "marketScreen.transaction.escrowStatus",
            value: escrowLabel(transaction.status, transaction.isCredit),
            tone:
              transaction.status.includes("DISPUTED") ||
              transaction.status === "PAYMENT_FAILED"
                ? "danger"
                : "default"
          }
        ]}
      />

      <OrderContactCard
        displayName={counterparty}
        subtitle={t("marketScreen.transaction.marketplaceCounterparty")}
        onMessage={onMessage}
        messageBusy={messageBusy}
      />

      <OrderActivityFeed events={activityEvents(transaction)} />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  referenceBlock: { flex: 1, gap: 2 },
  referenceLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  referenceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  reference: {
    fontSize: 18,
    fontWeight: "800",
    color: mobileColors.textPrimary,
    flexShrink: 1
  },
  deadline: {
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md
  },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: mobileColors.border
  }
});
