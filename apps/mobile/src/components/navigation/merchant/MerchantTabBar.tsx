import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { mobileSpacing, mobileTypography, mobileFontSize } from "../../../theme/mobileTheme";
import { merchantColors, merchantShadow, merchantRadius } from "../../../theme/merchantTheme";
import { MERCHANT_NAV_BAR_HEIGHT } from "./merchantNavMetrics";
import type { MerchantMainTab } from "./types";

type Props = {
  activeTab: MerchantMainTab | null;
  onTabPress: (tab: MerchantMainTab) => void;
};

const TAB_ORDER: MerchantMainTab[] = ["home", "shops", "products", "marketplace", "orders"];

const TAB_META: Record<
  MerchantMainTab,
  { icon: keyof typeof Ionicons.glyphMap; iconOutline: keyof typeof Ionicons.glyphMap; labelKey: string }
> = {
  home: { icon: "home", iconOutline: "home-outline", labelKey: "merchant.nav.home" },
  shops: { icon: "business", iconOutline: "business-outline", labelKey: "merchant.nav.shops" },
  products: { icon: "cube", iconOutline: "cube-outline", labelKey: "merchant.nav.products" },
  marketplace: { icon: "storefront", iconOutline: "storefront-outline", labelKey: "merchant.nav.marketplace" },
  orders: { icon: "receipt", iconOutline: "receipt-outline", labelKey: "merchant.nav.orders" }
};

const H = MERCHANT_NAV_BAR_HEIGHT;

function NavItem({
  testID,
  icon,
  iconOutline,
  label,
  active,
  onPress,
  a11y
}: {
  testID: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
  a11y: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [styles.hit, pressed && { opacity: 0.9 }]}
    >
      {active ? (
        <View style={styles.activePill}>
          <Ionicons name={icon} size={17} color={merchantColors.onPrimary} />
          <Text style={styles.labelActive} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : (
        <>
          <Ionicons name={iconOutline} size={22} color={merchantColors.textMuted} />
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function MerchantTabBar({ activeTab, onTabPress }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row} pointerEvents="box-none">
      <View style={[styles.pill, merchantShadow.floating, { height: H }]}>
        {TAB_ORDER.map((tab) => {
          const meta = TAB_META[tab];
          return (
            <NavItem
              key={tab}
              testID={`merchant-tab-${tab}`}
              icon={meta.icon}
              iconOutline={meta.iconOutline}
              label={t(meta.labelKey)}
              active={activeTab === tab}
              onPress={() => onTabPress(tab)}
              a11y={t(meta.labelKey)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    pointerEvents: "box-none"
  },
  pill: {
    flex: 1,
    minWidth: 0,
    borderRadius: merchantRadius.pill,
    backgroundColor: merchantColors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: merchantColors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: mobileSpacing.xs
  },
  hit: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 2
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: merchantColors.primary,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: merchantRadius.pill,
    maxWidth: "100%"
  },
  label: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    lineHeight: 11,
    fontWeight: "600",
    color: merchantColors.textMuted
  },
  labelActive: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    lineHeight: 11,
    fontWeight: "700",
    color: merchantColors.onPrimary
  }
});
