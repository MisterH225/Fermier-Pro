import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { ChatModuleGate } from "../components/ChatModuleGate";
import { useSession } from "../context/SessionContext";
import {
  directConversationTitle,
  ensureDirectChatRoom,
  searchUsersForChat,
  type UserSearchResultDto
} from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ChatSearchUser">;

export function ChatSearchUserScreen({ navigation }: Props) {
  const { accessToken, activeProfileId, authMe } = useSession();
  const qc = useQueryClient();
  const myUserId = authMe?.user.id ?? "";
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(rawQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const canSearch = debouncedQ.length >= 2;

  const searchQuery = useQuery({
    queryKey: ["chatUserSearch", debouncedQ, activeProfileId],
    queryFn: () =>
      searchUsersForChat(accessToken, debouncedQ, activeProfileId),
    enabled: canSearch
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

  const rows = searchQuery.data ?? [];

  const renderItem = ({ item }: { item: UserSearchResultDto }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => openDirect.mutate(item.id)}
      disabled={openDirect.isPending}
    >
      <Text style={styles.cardTitle}>
        {item.fullName?.trim() || item.email || "Utilisateur"}
      </Text>
      {item.email ? (
        <Text style={styles.cardSub}>{item.email}</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <ChatModuleGate>
      <View style={styles.wrap}>
        <TextInput
          style={styles.input}
          value={rawQuery}
          onChangeText={setRawQuery}
          placeholder="Nom ou e-mail — cercle de tes fermes"
          placeholderTextColor="#9aa088"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {!canSearch ? (
          <Text style={styles.hint}>
            Saisis au moins 2 caractères pour lancer la recherche.
          </Text>
        ) : searchQuery.isPending ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#5d7a1f" />
          </View>
        ) : searchQuery.error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>
              {searchQuery.error instanceof Error
                ? searchQuery.error.message
                : String(searchQuery.error)}
            </Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.empty}>Aucun résultat.</Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={renderItem}
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
  wrap: { flex: 1, backgroundColor: "#f9f8ea", paddingTop: 12 },
  input: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d4dac8",
    backgroundColor: "#fff",
    fontSize: 16,
    color: "#1f2910"
  },
  hint: {
    paddingHorizontal: 20,
    fontSize: 13,
    color: "#6d745b",
    lineHeight: 18
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
  empty: { fontSize: 15, color: "#6d745b" },
  mutationErr: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    color: "#b00020",
    fontSize: 13
  }
});
