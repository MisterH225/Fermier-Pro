import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { offerStatusLabel } from "../../lib/marketplaceLabels";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { BuyerCreditScoreDto } from "../../lib/api";
import { formatMarketMoney, parseMarketNum } from "./MarketplaceListingCard";
import { CreditScoreBadge } from "./CreditScoreBadge";
import { BalanceTrackingCard } from "./BalanceTrackingCard";
import { MemberAvatar } from "../collaboration/MemberAvatar";
import { ListingShareButton } from "./ListingShareButton";
import type { ListingShareInput } from "../../lib/shareMarketplaceListing";
import type { RootStackParamList } from "../../types/navigation";

type ProposalCardBase = {
  id: string;
  offeredPrice: string | number;
  quantity: number | null;
  message: string | null;
  status: string;
  createdAt: string;
  currency: string;
  listingTitle: string;
  offerType?: string | null;
  advancePercentage?: number | null;
  advanceAmount?: string | number | null;
  balanceAmount?: string | number | null;
  balanceDueDays?: number | null;
  balanceDueAt?: string | null;
  advancePaidDeclaredAt?: string | null;
  advanceConfirmedAt?: string | null;
  balancePaidDeclaredAt?: string | null;
  buyerCreditScore?: BuyerCreditScoreDto | null;
  listingCategory?: string | null;
  listingWeightKg?: string | number | null;
  subtitle?: string | null;
  highlighted?: boolean;
  onPressListing?: () => void;
  actionsDisabled?: boolean;
  listingShare?: ListingShareInput;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
};

type ReceivedProps = ProposalCardBase & {
  variant: "received";
  buyerName: string | null;
  onAccept?: () => void;
  onReject?: () => void;
  onCounter?: () => void;
  onNegotiate?: () => void;
  onConfirmAdvance?: () => void;
  onRejectAdvance?: () => void;
  onConfirmBalance?: () => void;
  onRejectBalance?: () => void;
};

type SentProps = ProposalCardBase & {
  variant: "sent";
  sellerName?: string | null;
  onWithdraw?: () => void;
  onAcceptCounter?: () => void;
  onDeclareAdvance?: () => void;
  onDeclareBalance?: () => void;
  onContactSeller?: () => void;
  withdrawLoading?: boolean;
  acceptCounterLoading?: boolean;
};

export type ProposalCardProps = ReceivedProps | SentProps;

const TERMINAL_OFFER_STATUSES = new Set(["completed", "cancelled"]);

function offerAllowsFollowUpMessage(status: string): boolean {
  return !TERMINAL_OFFER_STATUSES.has(status);
}

function formatOfferAmount(
  offeredPrice: string | number,
  currency: string,
  quantity: number | null
): string {
  const n = parseMarketNum(offeredPrice);
  const base = n != null ? formatMarketMoney(n, currency) : String(offeredPrice);
  return quantity != null ? `${base} × ${quantity}` : base;
}

function statusBadgeStyle(status: string) {
  switch (status) {
    case "accepted":
      return styles.badgeAccepted;
    case "rejected":
    case "withdrawn":
      return styles.badgeRejected;
    case "countered":
      return styles.badgeCounter;
    default:
      return styles.badgePending;
  }
}

export function ProposalCard(props: ProposalCardProps) {
  const { t } = useTranslation();
  const {
    variant,
    offeredPrice,
    quantity,
    message,
    status,
    createdAt,
    currency,
    listingTitle,
    offerType,
    advancePercentage,
    advanceAmount,
    balanceAmount,
    balanceDueDays,
    balanceDueAt,
    advancePaidDeclaredAt,
    advanceConfirmedAt,
    balancePaidDeclaredAt,
    buyerCreditScore,
    listingCategory,
    listingWeightKg,
    subtitle,
    highlighted,
    onPressListing,
    actionsDisabled,
    listingShare,
    navigation
  } = props;

  const isCredit = offerType === "credit";
  const advanceNum = parseMarketNum(advanceAmount);
  const balanceNum = parseMarketNum(balanceAmount);

  const weightKg = parseMarketNum(listingWeightKg);
  const categoryLabel = listingCategory
    ? t(`marketScreen.categories.${listingCategory}`, {
        defaultValue: listingCategory
      })
    : null;
  const listingMeta = [categoryLabel, weightKg != null ? `${weightKg} kg` : null]
    .filter(Boolean)
    .join(" · ");

  const dateLabel = new Date(createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  const showReceivedContactButton =
    variant === "received" &&
    !actionsDisabled &&
    props.onNegotiate &&
    offerAllowsFollowUpMessage(status) &&
    !(status === "pending" && !isCredit);

  const showSentContactButton =
    variant === "sent" &&
    !actionsDisabled &&
    props.onContactSeller &&
    offerAllowsFollowUpMessage(status);

  return (
    <View style={[styles.card, highlighted && styles.cardHighlighted]}>
      {listingShare && navigation ? (
        <ListingShareButton
          listing={listingShare}
          navigation={navigation}
          size={18}
          color={mobileColors.textSecondary}
          style={styles.cardShareBtn}
        />
      ) : null}
      <Pressable
        onPress={onPressListing}
        disabled={!onPressListing}
        style={styles.headerPress}
      >
        {variant === "received" ? (
          <MemberAvatar
            name={props.buyerName ?? "?"}
            size={40}
          />
        ) : (
          <View style={styles.sentIcon}>
            <Ionicons name="pricetag-outline" size={20} color={mobileColors.accent} />
          </View>
        )}
        <View style={styles.headerBody}>
          <Text style={styles.title} numberOfLines={2}>
            {variant === "received"
              ? props.buyerName?.trim() || t("marketScreen.proposals.anonymousBuyer")
              : listingTitle}
          </Text>
          {variant === "sent" && props.sellerName ? (
            <Text style={styles.subtitle}>{props.sellerName}</Text>
          ) : null}
          {variant === "received" ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {listingTitle}
              {listingMeta ? ` · ${listingMeta}` : ""}
            </Text>
          ) : listingMeta ? (
            <Text style={styles.subtitle}>{listingMeta}</Text>
          ) : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </Pressable>

      {isCredit ? (
        <Text style={styles.creditBadge}>💳 {t("marketScreen.creditModal.badge")}</Text>
      ) : null}

      {isCredit && advancePercentage != null ? (
        <View style={styles.creditDetails}>
          <Text style={styles.creditLine}>
            {t("marketScreen.credit.termsAdvance", {
              pct: advancePercentage,
              amount:
                advanceNum != null
                  ? formatMarketMoney(advanceNum, currency)
                  : "—"
            })}
          </Text>
          <Text style={styles.creditLine}>
            {t("marketScreen.credit.termsBalance", {
              amount:
                balanceNum != null
                  ? formatMarketMoney(balanceNum, currency)
                  : "—",
              days: balanceDueDays ?? "—"
            })}
          </Text>
          {variant === "received" ? (
            <CreditScoreBadge
              score={buyerCreditScore}
              prefix={t("marketScreen.credit.buyerScore")}
            />
          ) : null}
        </View>
      ) : null}

      {isCredit &&
      (status === "balance_pending" || status === "balance_declared") &&
      balanceNum != null ? (
        <BalanceTrackingCard
          balanceAmount={balanceNum}
          currency={currency}
          balanceDueAt={balanceDueAt ?? null}
          status={status}
        />
      ) : null}

      <View style={styles.amountRow}>
        <Text style={styles.amount}>
          {formatOfferAmount(offeredPrice, currency, quantity)}
        </Text>
        <View style={[styles.badge, statusBadgeStyle(status)]}>
          <Text style={styles.badgeTx}>{offerStatusLabel(status)}</Text>
        </View>
      </View>

      <Text style={styles.date}>{dateLabel}</Text>

      {message?.trim() ? <Text style={styles.message}>{message.trim()}</Text> : null}

      {variant === "received" &&
      status === "pending" &&
      !actionsDisabled &&
      !isCredit ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={props.onAccept}
            disabled={!props.onAccept}
          >
            <Text style={styles.btnPrimaryTx}>{t("marketScreen.offerAccept")}</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnOutline]}
            onPress={props.onCounter}
            disabled={!props.onCounter}
          >
            <Text style={styles.btnOutlineTx}>
              {t("marketScreen.offerCounter")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnDangerOutline]}
            onPress={props.onReject}
            disabled={!props.onReject}
          >
            <Text style={styles.btnDangerTx}>{t("marketScreen.offerReject")}</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={props.onNegotiate}
            disabled={!props.onNegotiate}
          >
            <Text style={styles.btnGhostTx}>
              {t("marketScreen.proposals.negotiate")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {variant === "received" &&
      isCredit &&
      status === "pending" &&
      !actionsDisabled ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={props.onAccept}
            disabled={!props.onAccept}
          >
            <Text style={styles.btnPrimaryTx}>
              {t("marketScreen.credit.accept")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnOutline]}
            onPress={props.onCounter}
            disabled={!props.onCounter}
          >
            <Text style={styles.btnOutlineTx}>
              {t("marketScreen.credit.counter")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnDangerOutline]}
            onPress={props.onReject}
            disabled={!props.onReject}
          >
            <Text style={styles.btnDangerTx}>{t("marketScreen.offerReject")}</Text>
          </Pressable>
        </View>
      ) : null}

      {variant === "received" &&
      isCredit &&
      status === "credit_agreed" &&
      advancePaidDeclaredAt &&
      !advanceConfirmedAt &&
      !actionsDisabled ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={props.onConfirmAdvance}
            disabled={!props.onConfirmAdvance}
          >
            <Text style={styles.btnPrimaryTx}>
              {t("marketScreen.credit.advance.confirmReceived")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnDangerOutline]}
            onPress={props.onRejectAdvance}
            disabled={!props.onRejectAdvance}
          >
            <Text style={styles.btnDangerTx}>
              {t("marketScreen.credit.advance.notReceived")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {variant === "received" &&
      isCredit &&
      status === "balance_declared" &&
      !actionsDisabled ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={props.onConfirmBalance}
            disabled={!props.onConfirmBalance}
          >
            <Text style={styles.btnPrimaryTx}>
              {t("marketScreen.credit.balance.confirmReceived")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnDangerOutline]}
            onPress={props.onRejectBalance}
            disabled={!props.onRejectBalance}
          >
            <Text style={styles.btnDangerTx}>
              {t("marketScreen.credit.balance.notReceived")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {variant === "sent" &&
      status === "countered" &&
      !actionsDisabled &&
      !isCredit ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={props.onAcceptCounter}
            disabled={!props.onAcceptCounter || props.acceptCounterLoading}
          >
            {props.acceptCounterLoading ? (
              <ActivityIndicator color={mobileColors.onAccent} />
            ) : (
              <Text style={styles.btnPrimaryTx}>
                {t("marketScreen.acceptCounter")}
              </Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnDangerOutline]}
            onPress={props.onWithdraw}
            disabled={!props.onWithdraw || props.withdrawLoading}
          >
            <Text style={styles.btnDangerTx}>{t("marketScreen.offerReject")}</Text>
          </Pressable>
        </View>
      ) : null}

      {variant === "sent" &&
      isCredit &&
      status === "countered" &&
      !actionsDisabled ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={props.onAcceptCounter}
            disabled={!props.onAcceptCounter || props.acceptCounterLoading}
          >
            {props.acceptCounterLoading ? (
              <ActivityIndicator color={mobileColors.onAccent} />
            ) : (
              <Text style={styles.btnPrimaryTx}>
                {t("marketScreen.credit.acceptCounter")}
              </Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnDangerOutline]}
            onPress={props.onWithdraw}
            disabled={!props.onWithdraw || props.withdrawLoading}
          >
            <Text style={styles.btnDangerTx}>{t("marketScreen.offerReject")}</Text>
          </Pressable>
        </View>
      ) : null}

      {variant === "sent" &&
      isCredit &&
      status === "credit_agreed" &&
      !advancePaidDeclaredAt &&
      !actionsDisabled ? (
        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={props.onDeclareAdvance}
          disabled={!props.onDeclareAdvance}
        >
          <Text style={styles.btnPrimaryTx}>
            {t("marketScreen.credit.advance.payEscrow")}
          </Text>
        </Pressable>
      ) : null}

      {variant === "sent" &&
      isCredit &&
      status === "balance_pending" &&
      !balancePaidDeclaredAt &&
      !actionsDisabled ? (
        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={props.onDeclareBalance}
          disabled={!props.onDeclareBalance}
        >
          <Text style={styles.btnPrimaryTx}>
            {t("marketScreen.credit.balance.payEscrow")}
          </Text>
        </Pressable>
      ) : null}

      {variant === "sent" && status === "pending" && !actionsDisabled && !isCredit ? (
        <Pressable
          style={styles.withdrawBtn}
          onPress={props.onWithdraw}
          disabled={!props.onWithdraw || props.withdrawLoading}
        >
          <Text style={styles.withdrawTx}>
            {t("marketScreen.withdrawAction")}
          </Text>
        </Pressable>
      ) : null}

      {showReceivedContactButton ? (
        <Pressable
          style={[styles.btn, styles.btnGhost, styles.contactBtn]}
          onPress={props.onNegotiate}
        >
          <Text style={styles.btnGhostTx}>
            {t("marketScreen.proposals.contactBuyer")}
          </Text>
        </Pressable>
      ) : null}

      {showSentContactButton ? (
        <Pressable
          style={[styles.btn, styles.btnGhost, styles.contactBtn]}
          onPress={props.onContactSeller}
        >
          <Text style={styles.btnGhostTx}>
            {t("marketScreen.detail.contactSeller")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm,
    position: "relative"
  },
  cardShareBtn: {
    position: "absolute",
    top: mobileSpacing.sm,
    right: mobileSpacing.sm,
    zIndex: 1
  },
  cardHighlighted: {
    borderColor: mobileColors.accent,
    borderWidth: 2,
    backgroundColor: mobileColors.accentSoft
  },
  headerPress: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.md
  },
  sentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  headerBody: { flex: 1, gap: 2 },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  subtitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  amount: {
    ...mobileTypography.title,
    fontSize: 18,
    color: mobileColors.textPrimary
  },
  badge: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill
  },
  badgePending: { backgroundColor: mobileColors.surfaceMuted },
  badgeAccepted: { backgroundColor: "#E8F5E9" },
  badgeRejected: { backgroundColor: "#FFEBEE" },
  badgeCounter: { backgroundColor: mobileColors.accentSoft },
  creditBadge: {
    ...mobileTypography.meta,
    color: "#BA7517",
    fontWeight: "700",
    marginBottom: mobileSpacing.xs
  },
  creditDetails: {
    gap: 2,
    marginBottom: mobileSpacing.xs
  },
  creditLine: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  badgeTx: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  date: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  message: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  },
  actions: {
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.xs
  },
  btn: {
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44
  },
  btnPrimary: { backgroundColor: mobileColors.accent },
  btnPrimaryTx: { color: mobileColors.onAccent, fontWeight: "700" },
  btnOutline: {
    borderWidth: 1,
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  btnOutlineTx: { color: mobileColors.accent, fontWeight: "700" },
  btnDangerOutline: {
    borderWidth: 1,
    borderColor: mobileColors.error
  },
  btnDangerTx: { color: mobileColors.error, fontWeight: "700" },
  btnGhost: { backgroundColor: mobileColors.surfaceMuted },
  contactBtn: { marginTop: mobileSpacing.sm },
  btnGhostTx: { color: mobileColors.textPrimary, fontWeight: "600" },
  withdrawBtn: {
    alignSelf: "flex-start",
    paddingVertical: mobileSpacing.xs
  },
  withdrawTx: {
    ...mobileTypography.body,
    color: mobileColors.error,
    fontWeight: "600"
  }
});
