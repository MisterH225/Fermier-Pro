import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import type { FarmDto } from "../lib/api";
import { fetchFarms } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmList">;

export function FarmListScreen({ navigation }: Props) {
  const { accessToken, signOut } = useSession();
  const [farms, setFarms] = useState<FarmDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => void signOut()}
          style={styles.headerBtn}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          <Text style={styles.headerBtnText}>Déconnexion</Text>
        </TouchableOpacity>
      )
    });
  }, [navigation, signOut]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchFarms(accessToken);
        if (!cancelled) {
          setFarms(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.hint}>
          Vérifie EXPO_PUBLIC_API_URL (émulateur : souvent http://10.0.2.2:3000).
        </Text>
      </View>
    );
  }

  if (!farms) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5d7a1f" />
      </View>
    );
  }

  if (farms.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Aucune ferme</Text>
        <Text style={styles.emptySub}>
          Crée une ferme depuis le producteur (API POST /farms avec profil
          producer) pour la voir ici.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={farms}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() =>
            navigation.navigate("FarmDetail", {
              farmId: item.id,
              farmName: item.name
            })
          }
        >
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSub}>
            {item.speciesFocus} · mode {item.livestockMode}
          </Text>
          {item.address ? (
            <Text style={styles.cardAddr} numberOfLines={2}>
              {item.address}
            </Text>
          ) : null}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 32
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
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2910"
  },
  cardSub: {
    marginTop: 6,
    fontSize: 14,
    color: "#6d745b"
  },
  cardAddr: {
    marginTop: 8,
    fontSize: 13,
    color: "#4b513d"
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  errorText: {
    color: "#b00020",
    textAlign: "center",
    fontSize: 14
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    color: "#6d745b",
    textAlign: "center"
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2910"
  },
  emptySub: {
    marginTop: 10,
    fontSize: 14,
    color: "#6d745b",
    textAlign: "center",
    lineHeight: 20
  },
  headerBtn: {
    paddingHorizontal: 4
  },
  headerBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15
  }
});
