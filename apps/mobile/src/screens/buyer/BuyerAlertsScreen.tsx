import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { buyerColors } from "../../theme/buyerTheme";
import type { RootStackParamList } from "../../types/navigation";

/** Deep link → segment Alertes de BuyerMarket. */
export function BuyerAlertsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useFocusEffect(
    useCallback(() => {
      navigation.navigate("BuyerMarket", { segment: "alerts" });
    }, [navigation])
  );

  return (
    <BuyerMobileShell hideTopBar>
      <View style={styles.wrap}>
        <ActivityIndicator color={buyerColors.primary} />
      </View>
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center" }
});
