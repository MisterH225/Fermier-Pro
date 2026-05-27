import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { mobileSpacing, mobileTypography } from "../../../theme/mobileTheme";
import { buyerColors, buyerShadow, buyerRadius } from "../../../theme/buyerTheme";
import { BUYER_NAV_BAR_HEIGHT } from "./buyerNavMetrics";
import type { BuyerMainTab } from "./types";

type Props = {
  activeTab: BuyerMainTab | null;
  onTabPress: (tab: BuyerMainTab) => void;
  onOpenExtended: () => void;
};

const TAB_ORDER: BuyerMainTab[] = ["home", "market", "messages", "history"];

const TAB_META: Record<BuyerMainTab, { icon: keyof typeof Ionicons.glyphMap; iconOutline: keyof typeof Ionicons.glyphMap; labelKey: string }> = {
  home: { icon: "home", iconOutline: "home-outline", labelKey: "buyer.nav.home" },
  market: { icon: "cart", iconOutline: "cart-outline", labelKey: "buyer.nav.market" },
  messages: { icon: "chatbubbles", iconOutline: "chatbubbles-outline", labelKey: "buyer.nav.messages" },
  history: { icon: "receipt", iconOutline: "receipt-outline", labelKey: "buyer.nav.history" },
};

const H = BUYER_NAV_BAR_HEIGHT;

function NavItem({ icon, iconOutline, label, active, onPress, a11y }: {
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
  a11y: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={({ pressed }) => [styles.hit, pressed && { opacity: 0.9 }]}>
      {active ? (
        <View style={styles.activePill}>
          <Ionicons name={icon} size={17} color="#fff" />
          <Text style={styles.labelActive} numberOfLines={1}>{label}</Text>
        </View>
      ) : (
        <>
          <Ionicons name={iconOutline} size={22} color={buyerColors.textMuted} />
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function BuyerTabBar({ activeTab, onTabPress, onOpenExtended }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row} pointerEvents="box-none">
      <View style={[styles.pill, buyerShadow.floating, { height: H }]}>
        {TAB_ORDER.map((tab) => {
          const meta = TAB_META[tab];
          return (
            <NavItem
              key={tab}
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("navigation.extended.openA11y")}
        onPress={onOpenExtended}
        style={({ pressed }) => [styles.plusOuter, buyerShadow.floating, { width: H, height: H, borderRadius: H / 2, opacity: pressed ? 0.92 : 1 }]}
      >
        <Ionicons name="add" size={Math.round(H * 0.36)} color={buyerColors.primary} />
        <Text style={styles.plusLabel} numberOfLines={1}>{t("navigation.extended.menuShort")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%", flexDirection: "row", alignItems: "center", gap: mobileSpacing.sm, pointerEvents: "box-none" },
  pill: { flex: 1, minWidth: 0, borderRadius: buyerRadius.pill, backgroundColor: buyerColors.cardBg, borderWidth: StyleSheet.hairlineWidth, borderColor: buyerColors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", paddingHorizontal: mobileSpacing.xs },
  hit: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingVertical: 4, gap: 2 },
  activePill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: buyerColors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: buyerRadius.pill, maxWidth: "100%" },
  label: { ...mobileTypography.meta, fontSize: 9, lineHeight: 11, fontWeight: "600", color: buyerColors.textMuted },
  labelActive: { ...mobileTypography.meta, fontSize: 11, lineHeight: 13, fontWeight: "700", color: "#fff" },
  plusOuter: { alignItems: "center", justifyContent: "center", gap: 1, paddingVertical: 4, backgroundColor: buyerColors.cardBg, borderWidth: StyleSheet.hairlineWidth, borderColor: buyerColors.border },
  plusLabel: { ...mobileTypography.meta, fontSize: 9, lineHeight: 11, fontWeight: "600", color: buyerColors.textSecondary }
});
