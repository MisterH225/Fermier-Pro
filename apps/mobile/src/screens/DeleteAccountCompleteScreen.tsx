import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "DeleteAccountComplete">;

export function DeleteAccountCompleteScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { signOut } = useSession();
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      gestureEnabled: false
    });
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [navigation]);

  const onClose = async () => {
    setClosing(true);
    try {
      await signOut();
    } finally {
      setClosing(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.icon}>✅</Text>
      <Text style={styles.title}>{t("account.deleteAccount.doneTitle")}</Text>
      <Text style={styles.message}>{t("account.deleteAccount.doneMessage")}</Text>
      <Pressable
        style={[styles.btn, closing && styles.btnOff]}
        onPress={() => void onClose()}
        disabled={closing}
      >
        {closing ? (
          <ActivityIndicator color={mobileColors.onAccent} />
        ) : (
          <Text style={styles.btnTx}>{t("account.deleteAccount.close")}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: mobileColors.canvas,
    padding: mobileSpacing.xl
  },
  icon: {
    fontSize: 48,
    marginBottom: mobileSpacing.lg
  },
  title: {
    ...mobileTypography.title,
    fontSize: 22,
    color: mobileColors.textPrimary,
    textAlign: "center",
    marginBottom: mobileSpacing.md
  },
  message: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: mobileSpacing.xl
  },
  btn: {
    minWidth: 200,
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    paddingHorizontal: mobileSpacing.xl,
    alignItems: "center"
  },
  btnOff: {
    opacity: 0.7
  },
  btnTx: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.onAccent
  }
});
