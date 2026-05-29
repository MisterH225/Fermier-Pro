import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { useBuyerBottomChromePad } from "../../context/BuyerBottomChromeContext";
import { buyerColors } from "../../theme/buyerTheme";
import type { RootStackParamList } from "../../types/navigation";

export function BuyerMessagesScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomPad = useBuyerBottomChromePad();

  useFocusEffect(
    useCallback(() => {
      navigation.navigate("ChatRooms");
    }, [navigation])
  );

  return (
    <BuyerMobileShell>
      <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
        <ActivityIndicator color={buyerColors.primary} />
      </View>
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center" }
});
