import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useLayoutEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { ChatModuleGate } from "../components/ChatModuleGate";
import { useSession } from "../context/SessionContext";
import type { ChatRoomListItem } from "../lib/api";
import { directConversationTitle, fetchChatRooms } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ChatRooms">;

function roomTitle(room: ChatRoomListItem, myUserId?: string): string {
  if (room.farm?.name) return room.farm.name;
  if (room.title?.trim()) return room.title.trim();
  if (room.kind === "direct") {
    return myUserId
      ? directConversationTitle(room, myUserId)
      : "Message direct";
  }
  return "Salon";
}

function lastPreview(room: ChatRoomListItem): string | null {
  const last = room.messages?.[0];
  if (!last?.body) return null;
  const who = last.sender?.fullName?.trim() || "Quelqu’un";
  const snippet =
    last.body.length > 80 ? `${last.body.slice(0, 78)}…` : last.body;
  return `${who} · ${snippet}`;
}

export function ChatRoomsScreen({ navigation }: Props) {
  const { accessToken, activeProfileId, authMe } = useSession();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("ChatPickFarm")}
          style={{ paddingHorizontal: 8 }}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
            Nouveau
          </Text>
        </TouchableOpacity>
      )
    });
  }, [navigation]);

  const roomsQuery = useQuery({
    queryKey: ["chatRooms", activeProfileId],
    queryFn: () => fetchChatRooms(accessToken, activeProfileId)
  });

  useFocusEffect(
    useCallback(() => {
      void roomsQuery.refetch();
    }, [roomsQuery.refetch])
  );

  const rooms = roomsQuery.data ?? [];

  return (
    <ChatModuleGate>
      <View style={styles.wrap}>
        {roomsQuery.isPending ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#5d7a1f" />
          </View>
        ) : roomsQuery.error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>
              {roomsQuery.error instanceof Error
                ? roomsQuery.error.message
                : String(roomsQuery.error)}
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
                refreshing={roomsQuery.isRefetching}
                onRefresh={() => void roomsQuery.refetch()}
                tintColor="#5d7a1f"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Aucune conversation</Text>
                <Text style={styles.emptySub}>
                  Ouvre une ferme puis « Salon de la ferme » pour rejoindre le
                  fil lié à cette exploitation.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() =>
                  navigation.navigate("ChatRoom", {
                    roomId: item.id,
                    headline: roomTitle(item, authMe?.user.id)
                  })
                }
              >
                <Text style={styles.cardTitle}>
                  {roomTitle(item, authMe?.user.id)}
                </Text>
                {lastPreview(item) ? (
                  <Text style={styles.cardPreview} numberOfLines={2}>
                    {lastPreview(item)}
                  </Text>
                ) : (
                  <Text style={styles.cardMuted}>Pas encore de message</Text>
                )}
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </ChatModuleGate>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#f9f8ea" },
  list: { padding: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  error: { color: "#b00020", textAlign: "center", fontSize: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e4d4"
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2910"
  },
  cardPreview: {
    marginTop: 8,
    fontSize: 14,
    color: "#4b513d",
    lineHeight: 20
  },
  cardMuted: {
    marginTop: 8,
    fontSize: 14,
    color: "#9aa088",
    fontStyle: "italic"
  },
  emptyBox: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    paddingTop: 48
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2910",
    marginBottom: 10
  },
  emptySub: {
    fontSize: 14,
    color: "#6d745b",
    lineHeight: 22
  }
});
