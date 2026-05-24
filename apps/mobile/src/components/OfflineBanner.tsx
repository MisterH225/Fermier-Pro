import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOfflineSync } from "../context/OfflineSyncContext";

/**
 * Bandeau réseau + file de synchronisation offline-first.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const {
    pendingCount,
    failedCount,
    isSyncing,
    syncNow,
    isOnline
  } = useOfflineSync();

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

  const showQueue = pendingCount > 0 || failedCount > 0;
  if (!offline && !showQueue) {
    return null;
  }

  return (
    <View
      style={[styles.wrap, { paddingTop: Math.max(insets.top, 10) }]}
      accessibilityRole="alert"
    >
      {offline ? (
        <Text style={styles.text}>{t("offline.bannerOffline")}</Text>
      ) : null}
      {showQueue ? (
        <View style={styles.row}>
          {isSyncing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : null}
          <Text style={styles.queueText}>
            {failedCount > 0
              ? t("offline.queueFailed", {
                  pending: pendingCount,
                  failed: failedCount
                })
              : t("offline.queuePending", { count: pendingCount })}
          </Text>
          {isOnline && !isSyncing ? (
            <Pressable
              onPress={() => void syncNow()}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.syncBtn}>{t("offline.syncNow")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#6d4c41",
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 6
  },
  text: {
    color: "#fff",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8
  },
  queueText: {
    color: "#fff",
    fontSize: 12,
    lineHeight: 16
  },
  syncBtn: {
    color: "#FFE082",
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "underline"
  }
});
