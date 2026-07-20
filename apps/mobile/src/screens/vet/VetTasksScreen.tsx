import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { VetMobileShell } from "../../components/layout";
import { vetColors } from "../../theme/vetTheme";
import type { RootStackParamList } from "../../types/navigation";

/** Deep link → liste des élevages (tâches dans le dossier). */
export function VetTasksScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useFocusEffect(
    useCallback(() => {
      navigation.navigate("VetFarms");
    }, [navigation])
  );

  return (
    <VetMobileShell hideTopBar>
      <View style={styles.wrap}>
        <ActivityIndicator color={vetColors.primary} />
      </View>
    </VetMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center" }
});
