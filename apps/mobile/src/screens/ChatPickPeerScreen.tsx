import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { ChatModuleGate } from "../components/ChatModuleGate";
import { useSession } from "../context/SessionContext";
import {
  directConversationTitle,
  ensureDirectChatRoom,
  fetchFarmMembers
} from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ChatPickPeer">;

export function ChatPickPeerScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, authMe } = useSession();
  const qc = useQueryClient();
  const myUserId = authMe?.user.id ?? "";

  const membersQuery = useQuery({
    queryKey: ["farmMembers", farmId, activeProfileId],
    queryFn: () => fetchFarmMembers(accessToken, farmId, activeProfileId)
  });

  const openDirect = useMutation({
    mutationFn: (peerUserId: string) =>
      ensureDirectChatRoom(accessToken, peerUserId, activeProfileId),
    onSuccess: (room) => {
      void qc.invalidateQueries({ queryKey: ["chatRooms", activeProfileId] });
      const headline =
        myUserId.length > 0
          ? directConversationTitle(room, myUserId)
          : "Message direct";
      navigation.replace("ChatRoom", {
        roomId: room.id,
        headline
      });
    }
  });

  const rows =
    membersQuery.data?.filter((m) => m.userId !== myUserId) ?? [];

  return (
    <ChatModuleGate>
      <View style={styles.wrap}>
        <Text style={styles.intro}>
          Membres de « {farmName} » — conversation privée
        </Text>
        {membersQuery.isPending ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#5d7a1f" />
          </View>
        ) : membersQuery.error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>
              {membersQuery.error instanceof Error
                ? membersQuery.error.message
                : String(membersQuery.error)}
            </Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.empty}>
              Aucun autre membre sur cette ferme (ou chargement du profil).
            </Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => openDirect.mutate(item.userId)}
                disabled={openDirect.isPending}
              >
                <Text style={styles.cardTitle}>
                  {item.user.fullName?.trim() || item.user.email || "Membre"}
                </Text>
                {item.user.email ? (
                  <Text style={styles.cardSub}>{item.user.email}</Text>
                ) : null}
              </TouchableOpacity>
            )}
          />
        )}
        {openDirect.error ? (
          <Text style={styles.mutationErr}>
            {openDirect.error instanceof Error
              ? openDirect.error.message
              : String(openDirect.error)}
          </Text>
        ) : null}
      </View>
    </ChatModuleGate>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#f9f8ea" },
  intro: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    fontSize: 14,
    color: "#4b513d",
    lineHeight: 20
  },
  list: { padding: 16, paddingBottom: 32 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
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
  cardSub: {
    marginTop: 6,
    fontSize: 14,
    color: "#6d745b"
  },
  error: { color: "#b00020", textAlign: "center" },
  empty: { fontSize: 15, color: "#6d745b", textAlign: "center" },
  mutationErr: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    color: "#b00020",
    fontSize: 13
  }
});
