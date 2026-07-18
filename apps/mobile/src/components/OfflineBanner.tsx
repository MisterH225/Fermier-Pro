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
import { isPermanentFailure } from "../lib/offline/types";
import type { OfflineQueueItem } from "../lib/offline/types";
import { mobileColors, mobileSpacing } from "../theme/mobileTheme";

function statusLabel(
  item: OfflineQueueItem,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (item.status === "synced") {
    return t("offline.itemSynced");
  }
  if (isPermanentFailure(item)) {
    return t("offline.itemFailed");
  }
  if (item.status === "syncing") {
    return t("offline.itemSyncing");
  }
  if (item.status === "failed") {
    return t("offline.itemRetrying", { count: item.retryCount });
  }
  return t("offline.itemPending");
}

/**
 * Bandeau réseau + file de synchronisation offline-first.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const {
    pendingCount,
    failedCount,
    isSyncing,
    syncNow,
    isOnline,
    queue,
    retryItem
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

  const awaitingCount = pendingCount + failedCount;
  const showQueue = queue.length > 0;
  if (!offline && !showQueue) {
    return null;
  }

  return (
    <View
      style={[styles.wrap, { paddingTop: Math.max(insets.top, 10) }]}
      accessibilityRole="alert"
      testID="offline-banner"
    >
      {offline ? (
        <Text style={styles.text}>{t("offline.bannerOffline")}</Text>
      ) : null}
      {showQueue ? (
        <View style={styles.queueBlock}>
          <View style={styles.row}>
            {isSyncing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : null}
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              accessibilityRole="button"
            >
              <Text style={styles.queueText} testID="offline-queue-pending">
                {awaitingCount > 0
                  ? t("offline.queuePending", { count: awaitingCount })
                  : t("offline.queueSyncedOnly")}
              </Text>
            </Pressable>
            {isOnline && !isSyncing && pendingCount > 0 ? (
              <Pressable
                onPress={() => void syncNow()}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={styles.syncBtn}>{t("offline.syncNow")}</Text>
              </Pressable>
            ) : null}
          </View>

          {expanded
            ? queue.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemTextCol}>
                    <Text style={styles.itemLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={styles.itemStatus}>{statusLabel(item, t)}</Text>
                    {item.lastError && isPermanentFailure(item) ? (
                      <Text style={styles.itemError} numberOfLines={2}>
                        {item.lastError}
                      </Text>
                    ) : null}
                  </View>
                  {isPermanentFailure(item) ? (
                    <Pressable
                      onPress={() => void retryItem(item.id)}
                      accessibilityRole="button"
                      style={styles.retryBtn}
                    >
                      <Text style={styles.retryBtnText}>
                        {t("offline.retry")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            : null}
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
  queueBlock: {
    gap: 8
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
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  itemTextCol: {
    flex: 1,
    gap: 2
  },
  itemLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600"
  },
  itemStatus: {
    color: "#FFE082",
    fontSize: 11
  },
  itemError: {
    color: "#ffcdd2",
    fontSize: 10,
    lineHeight: 13
  },
  retryBtn: {
    backgroundColor: mobileColors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700"
  }
});
