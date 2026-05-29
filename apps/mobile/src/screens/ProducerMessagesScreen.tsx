import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { MobileAppShell } from "../components/layout";
import { useProducerBottomChromePad } from "../context/ProducerBottomChromeContext";
import { useSession } from "../context/SessionContext";
import {
  directConversationTitle,
  fetchChatRooms,
  type ChatRoomListItem
} from "../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

function roomTitle(room: ChatRoomListItem, myUserId?: string): string {
  if (room.farm?.name) return room.farm.name;
  if (room.kind === "direct" && myUserId) {
    return directConversationTitle(room, myUserId);
  }
  return room.title?.trim() || "Conversation";
}

function lastPreview(room: ChatRoomListItem): string | null {
  const last = room.messages?.[0];
  if (!last?.body) return null;
  const who = last.sender?.fullName?.trim() || "Quelqu'un";
  const snippet =
    last.body.length > 80 ? `${last.body.slice(0, 78)}…` : last.body;
  return `${who} · ${snippet}`;
}

function lastTime(room: ChatRoomListItem): string | null {
  const last = room.messages?.[0];
  if (!last?.createdAt) return null;
  const d = new Date(last.createdAt);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return d.toLocaleString(undefined, {
    ...(sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "numeric", month: "short" })
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function ProducerMessagesScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomPad = useProducerBottomChromePad();
  const { accessToken, activeProfileId, authMe } = useSession();
  const myUserId = authMe?.user.id;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("ChatSearchUser")}
          style={{ paddingHorizontal: 8 }}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        >
          <Text style={styles.headerNewBtn}>
            {t("producer.messages.new")}
          </Text>
        </TouchableOpacity>
      )
    });
  }, [navigation, t]);

  const roomsQ = useQuery({
    queryKey: ["chatRooms", activeProfileId, "producerMessages"],
    queryFn: () => fetchChatRooms(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  useFocusEffect(
    useCallback(() => {
      void roomsQ.refetch();
    }, [roomsQ.refetch])
  );

  const rooms = roomsQ.data ?? [];

  return (
    <MobileAppShell hideTopBar omitBottomTabBar>
      <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
        {roomsQ.isPending ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={mobileColors.accent} />
          </View>
        ) : roomsQ.error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>
              {roomsQ.error instanceof Error
                ? roomsQ.error.message
                : String(roomsQ.error)}
            </Text>
          </View>
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
            contentContainerStyle={
              rooms.length === 0 ? styles.emptyList : styles.list
            }
            refreshControl={
              <RefreshControl
                refreshing={roomsQ.isRefetching}
                onRefresh={() => void roomsQ.refetch()}
                tintColor={mobileColors.accent}
              />
            }
            ItemSeparatorComponent={() => (
              <View style={{ height: mobileSpacing.xs }} />
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>
                  {t("producer.messages.emptyTitle")}
                </Text>
                <Text style={styles.emptySub}>
                  {t("producer.messages.emptySub")}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const title = roomTitle(item, myUserId);
              const preview = lastPreview(item);
              const time = lastTime(item);
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.card,
                    pressed && styles.cardPressed
                  ]}
                  onPress={() =>
                    navigation.navigate("ChatRoom", {
                      roomId: item.id,
                      headline: title
                    })
                  }
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarTx}>{initials(title)}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {title}
                      </Text>
                      {time ? (
                        <Text style={styles.cardTime}>{time}</Text>
                      ) : null}
                    </View>
                    {preview ? (
                      <Text style={styles.cardPreview} numberOfLines={2}>
                        {preview}
                      </Text>
                    ) : (
                      <Text style={styles.cardMuted}>
                        {t("producer.messages.noMessage")}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  list: { padding: mobileSpacing.md, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  error: {
    ...mobileTypography.meta,
    color: mobileColors.error,
    textAlign: "center"
  },
  emptyBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    paddingTop: 64
  },
  emptyTitle: {
    ...mobileTypography.title,
    fontSize: 18,
    color: mobileColors.textPrimary,
    textAlign: "center",
    marginBottom: 10
  },
  emptySub: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    lineHeight: 22
  },
  headerNewBtn: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm,
    borderWidth: 1,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  cardPressed: { opacity: 0.88 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${mobileColors.accent}1A`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  avatarTx: {
    fontWeight: "800",
    fontSize: 16,
    color: mobileColors.accent
  },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  cardTitle: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    flex: 1
  },
  cardTime: {
    ...mobileTypography.meta,
    fontSize: 11,
    color: mobileColors.textSecondary
  },
  cardPreview: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    lineHeight: 18
  },
  cardMuted: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontStyle: "italic"
  }
});
