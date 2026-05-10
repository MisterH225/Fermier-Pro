import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
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
import { fetchFarms } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ChatPickFarm">;

export function ChatPickFarmScreen({ navigation }: Props) {
  const { accessToken, activeProfileId } = useSession();

  const farmsQuery = useQuery({
    queryKey: ["farms", activeProfileId],
    queryFn: () => fetchFarms(accessToken, activeProfileId)
  });

  const farms = farmsQuery.data ?? [];

  return (
    <ChatModuleGate>
      <View style={styles.wrap}>
        <Text style={styles.intro}>
          Choisis une ferme pour voir ses membres et ouvrir une conversation
          directe.
        </Text>
        <TouchableOpacity
          style={styles.searchCta}
          onPress={() => navigation.navigate("ChatSearchUser")}
        >
          <Text style={styles.searchCtaText}>Rechercher par nom ou e-mail</Text>
          <Text style={styles.searchCtaSub}>
            Parmi les personnes liées à au moins une de tes fermes
          </Text>
        </TouchableOpacity>
        {farmsQuery.isPending ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#5d7a1f" />
          </View>
        ) : farmsQuery.error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>
              {farmsQuery.error instanceof Error
                ? farmsQuery.error.message
                : String(farmsQuery.error)}
            </Text>
          </View>
        ) : farms.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.empty}>Aucune ferme disponible.</Text>
          </View>
        ) : (
          <FlatList
            data={farms}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() =>
                  navigation.navigate("ChatPickPeer", {
                    farmId: item.id,
                    farmName: item.name
                  })
                }
              >
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSub}>
                  {item.speciesFocus} · {item.livestockMode}
                </Text>
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
  intro: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    fontSize: 14,
    color: "#4b513d",
    lineHeight: 20
  },
  searchCta: {
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#7a9a3a",
    backgroundColor: "#f0f5e4"
  },
  searchCtaText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3d5218"
  },
  searchCtaSub: {
    marginTop: 6,
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
  empty: { fontSize: 15, color: "#6d745b", textAlign: "center" }
});
