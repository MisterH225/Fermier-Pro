import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { StyleSheet } from "react-native";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { OrdersHubView } from "../../components/orders";
import { buyerOrderPalette } from "../../components/orders/orderTheme";
import { useBottomInset } from "../../hooks/useBottomInset";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Route = RouteProp<RootStackParamList, "BuyerHistory">;

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
        palette={buyerOrderPalette}
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
