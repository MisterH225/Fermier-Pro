import { Alert, Linking, Platform } from "react-native";

/** Ouvre le composeur téléphonique (ou affiche une alerte si numéro invalide). */
export async function openPhoneCall(
  rawPhone: string | null | undefined,
  options?: { errorTitle?: string; errorMessage?: string }
): Promise<boolean> {
  const digits = rawPhone?.replace(/[^\d+]/g, "").trim();
  if (!digits || digits.length < 6) {
    if (options?.errorMessage) {
      Alert.alert(
        options.errorTitle ?? "Téléphone",
        options.errorMessage
      );
    }
    return false;
  }
  const url = Platform.OS === "ios" ? `telprompt:${digits}` : `tel:${digits}`;
  const can = await Linking.canOpenURL(url);
  if (!can) {
    Alert.alert(
      options?.errorTitle ?? "Téléphone",
      options?.errorMessage ?? "Impossible d'ouvrir l'application téléphone."
    );
    return false;
  }
  await Linking.openURL(url);
  return true;
}
