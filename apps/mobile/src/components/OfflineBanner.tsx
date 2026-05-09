import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Bandeau lorsque l’appareil n’a pas de connexion données / Wi‑Fi.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void NetInfo.fetch().then((state) => {
      if (!cancelled) {
        setOffline(!state.isConnected);
      }
    });
    const sub = NetInfo.addEventListener((state) => {
      setOffline(!state.isConnected);
    });
    return () => {
      cancelled = true;
      sub();
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    <View
      style={[styles.wrap, { paddingTop: Math.max(insets.top, 10) }]}
      accessibilityRole="alert"
    >
      <Text style={styles.text}>
        Hors ligne — affichage du dernier état en cache (pas de synchro serveur).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#6d4c41",
    paddingHorizontal: 14,
    paddingBottom: 10
  },
  text: {
    color: "#fff",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18
  }
});
