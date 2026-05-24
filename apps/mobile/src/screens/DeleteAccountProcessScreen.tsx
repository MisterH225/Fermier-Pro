import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import { deleteMyAccount } from "../lib/api";
import { formatApiError } from "../lib/apiErrors";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "DeleteAccountProcess">;

export function DeleteAccountProcessScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { accessToken } = useSession();
  const started = useRef(false);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => running);
    return () => sub.remove();
  }, [running]);

  useEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      gestureEnabled: false
    });
  }, [navigation]);

  useEffect(() => {
    if (started.current || !accessToken) {
      return;
    }
    started.current = true;
    void (async () => {
      try {
        await deleteMyAccount(accessToken);
        setRunning(false);
        navigation.replace("DeleteAccountComplete");
      } catch (err) {
        setRunning(false);
        Alert.alert(
          t("account.deleteAccount.errorTitle"),
          formatApiError(err) || t("account.deleteAccount.errorGeneric"),
          [
            {
              text: t("account.deleteAccount.cancel"),
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    })();
  }, [accessToken, navigation, t]);

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={mobileColors.accent} />
      <Text style={styles.message}>{t("account.deleteAccount.processing")}</Text>
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
  message: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.lg,
    textAlign: "center"
  }
});
