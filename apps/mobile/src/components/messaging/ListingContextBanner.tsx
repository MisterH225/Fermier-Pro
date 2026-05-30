import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ChatListingSummary } from "../../lib/api";
import { ListingImage } from "../marketplace/ListingImage";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = {
  listing: ChatListingSummary;
};

export function ListingContextBanner({ listing }: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const priceLabel =
    listing.pricePerKg != null
      ? `${Math.round(listing.pricePerKg).toLocaleString("fr-FR")} ${listing.currency}/kg`
      : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.92 }]}
      onPress={() =>
        navigation.navigate("MarketplaceListingDetail", {
          listingId: listing.id,
          headline: listing.title
        })
      }
    >
      <ListingImage
        photos={listing.photoUrls}
        height={44}
        borderRadius={mobileRadius.sm}
        style={styles.thumb}
      />
      <View style={styles.body}>
        <Text style={styles.label}>Annonce</Text>
        <Text style={styles.title} numberOfLines={1}>
          {listing.title}
        </Text>
        {priceLabel ? (
          <Text style={styles.meta} numberOfLines={1}>
            {priceLabel}
          </Text>
        ) : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    marginHorizontal: mobileSpacing.md,
    marginTop: mobileSpacing.sm,
    marginBottom: mobileSpacing.xs,
    padding: mobileSpacing.sm,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  thumb: { width: 44 },
  body: { flex: 1, minWidth: 0 },
  label: {
    ...mobileTypography.meta,
    fontSize: 10,
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  title: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    fontSize: 14
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontSize: 12,
    marginTop: 2
  },
  chevron: {
    fontSize: 22,
    color: mobileColors.textSecondary,
    fontWeight: "300"
  }
});
