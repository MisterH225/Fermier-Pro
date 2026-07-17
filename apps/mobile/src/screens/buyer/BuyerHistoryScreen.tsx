import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { StyleSheet } from "react-native";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { OrdersHubView } from "../../components/orders";
import type { OrderPalette } from "../../components/orders/orderTheme";
import { ordersPalette } from "../../components/orders/orderTheme";
import { useBottomInset } from "../../hooks/useBottomInset";
import { buyerColors, buyerRadius, buyerShadow } from "../../theme/buyerTheme";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Route = RouteProp<RootStackParamList, "BuyerHistory">;

const buyerOrdersPalette: OrderPalette = {
  ...ordersPalette,
  primary: buyerColors.primary,
  primarySoft: buyerColors.primarySoft,
  primaryLight: buyerColors.primaryLight,
  primaryDark: buyerColors.primaryDark,
  cardBg: buyerColors.cardBg,
  textPrimary: buyerColors.textPrimary,
  textSecondary: buyerColors.textSecondary,
  textMuted: buyerColors.textMuted,
  warning: buyerColors.warning,
  danger: buyerColors.danger,
  border: buyerColors.border,
  onPrimary: buyerColors.onPrimary,
  radius: buyerRadius,
  shadow: buyerShadow,
  badges: {
    ...ordersPalette.badges,
    pending: {
      background: buyerColors.primaryLight,
      foreground: buyerColors.primaryDark
    }
  }
};

export function BuyerHistoryScreen() {
  const bottomInset = useBottomInset();
  const route = useRoute<Route>();

  return (
    <BuyerMobileShell hideTopBar>
      <OrdersHubView
        role="buyer"
        initialSegment={route.params?.initialSegment}
        legacyInitialTab={route.params?.initialTab}
        showReviewsLink
        palette={buyerOrdersPalette}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomInset + mobileSpacing.xl }
        ]}
      />
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1
  }
});
