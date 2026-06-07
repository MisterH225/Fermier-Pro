import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { offerStatusLabel } from "../../lib/marketplaceLabels";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { formatMarketMoney, parseMarketNum } from "./MarketplaceListingCard";
import { MemberAvatar } from "../collaboration/MemberAvatar";

type ProposalCardBase = {
  id: string;
  offeredPrice: string | number;
  quantity: number | null;
  message: string | null;
  status: string;
  createdAt: string;
  currency: string;
  listingTitle: string;
  listingCategory?: string | null;
  listingWeightKg?: string | number | null;
  subtitle?: string | null;
  onPressListing?: () => void;
  actionsDisabled?: boolean;
};

type ReceivedProps = ProposalCardBase & {
  variant: "received";
  buyerName: string | null;
  onAccept?: () => void;
  onReject?: () => void;
  onCounter?: () => void;
  onNegotiate?: () => void;
};

type SentProps = ProposalCardBase & {
  variant: "sent";
  sellerName?: string | null;
  onWithdraw?: () => void;
  onAcceptCounter?: () => void;
  withdrawLoading?: boolean;
  acceptCounterLoading?: boolean;
};

export type ProposalCardProps = ReceivedProps | SentProps;

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
    listingCategory,
    listingWeightKg,
    subtitle,
    onPressListing,
    actionsDisabled
  } = props;

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

  return (
    <View style={styles.card}>
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
      !actionsDisabled ? (
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

      {variant === "sent" && status === "countered" && !actionsDisabled ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={props.onAcceptCounter}
            disabled={!props.onAcceptCounter || props.acceptCounterLoading}
          >
            {props.acceptCounterLoading ? (
              <ActivityIndicator color="#fff" />
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

      {variant === "sent" && status === "pending" && !actionsDisabled ? (
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
    gap: mobileSpacing.sm
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
  btnPrimaryTx: { color: "#fff", fontWeight: "700" },
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
