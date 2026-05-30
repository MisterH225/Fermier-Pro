import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MarketplaceOfferChatPayload } from "../../lib/marketplaceOfferMessage";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = {
  payload: MarketplaceOfferChatPayload;
  isMine: boolean;
};

function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "En attente";
    case "countered":
      return "Contre-offre";
    case "accepted":
      return "Acceptée";
    case "rejected":
      return "Refusée";
    case "withdrawn":
      return "Retirée";
    default:
      return status;
  }
}

export function ProposalCardInChat({ payload, isMine }: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const priceLine =
    payload.proposedPricePerKg != null
      ? `${Math.round(payload.proposedPricePerKg).toLocaleString("fr-FR")} FCFA/kg`
      : `${Math.round(payload.offeredPrice).toLocaleString("fr-FR")} ${payload.currency}`;

  return (
    <Pressable
      style={[styles.wrap, isMine ? styles.wrapMine : styles.wrapOther]}
      onPress={() =>
        navigation.navigate("MarketplaceListingDetail", {
          listingId: payload.listingId,
          headline: payload.listingTitle
        })
      }
    >
      <Text style={styles.badge}>Proposition commerciale</Text>
      <Text style={styles.title} numberOfLines={2}>
        {payload.listingTitle}
      </Text>
      <Text style={styles.price}>{priceLine}</Text>
      {payload.quantity != null ? (
        <Text style={styles.meta}>Quantité : {payload.quantity}</Text>
      ) : null}
      {payload.message?.trim() ? (
        <Text style={styles.note} numberOfLines={3}>
          « {payload.message.trim()} »
        </Text>
      ) : null}
      <View style={styles.footer}>
        <Text style={styles.status}>{statusLabel(payload.status)}</Text>
        <Text style={styles.link}>Voir l’annonce →</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: "88%",
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    borderWidth: 1
  },
  wrapMine: {
    alignSelf: "flex-end",
    backgroundColor: "#E8F5E9",
    borderColor: mobileColors.accent
  },
  wrapOther: {
    alignSelf: "flex-start",
    backgroundColor: mobileColors.background,
    borderColor: mobileColors.border
  },
  badge: {
    ...mobileTypography.meta,
    fontSize: 10,
    fontWeight: "700",
    color: mobileColors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 6
  },
  title: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginBottom: 4
  },
  price: {
    fontSize: 18,
    fontWeight: "800",
    color: mobileColors.textPrimary,
    marginBottom: 4
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  note: {
    ...mobileTypography.meta,
    fontStyle: "italic",
    color: mobileColors.textSecondary,
    marginTop: 8,
    lineHeight: 18
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    gap: 8
  },
  status: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  link: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.accent
  }
});
