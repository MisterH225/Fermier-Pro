import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import type { FarmDto } from "../lib/api";
import { fetchFarm } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmDetail">;

export function FarmDetailScreen({ route }: Props) {
  const { farmId } = route.params;
  const { accessToken } = useSession();
  const [farm, setFarm] = useState<FarmDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchFarm(accessToken, farmId);
        if (!cancelled) {
          setFarm(data);
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
  }, [accessToken, farmId]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!farm) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5d7a1f" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.block}>
        <Text style={styles.label}>Espèce / focus</Text>
        <Text style={styles.value}>{farm.speciesFocus}</Text>
      </View>
      <View style={styles.block}>
        <Text style={styles.label}>Mode d&apos;élevage</Text>
        <Text style={styles.value}>{farm.livestockMode}</Text>
      </View>
      {farm.address ? (
        <View style={styles.block}>
          <Text style={styles.label}>Adresse</Text>
          <Text style={styles.value}>{farm.address}</Text>
        </View>
      ) : null}
      {farm.capacity != null ? (
        <View style={styles.block}>
          <Text style={styles.label}>Capacité</Text>
          <Text style={styles.value}>{String(farm.capacity)}</Text>
        </View>
      ) : null}
      {(farm.latitude != null || farm.longitude != null) && (
        <View style={styles.block}>
          <Text style={styles.label}>Coordonnées</Text>
          <Text style={styles.value}>
            {[farm.latitude, farm.longitude].filter(Boolean).join(", ")}
          </Text>
        </View>
      )}
      <Text style={styles.meta}>ID : {farm.id}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#f9f8ea"
  },
  content: {
    padding: 16,
    paddingBottom: 32
  },
  block: {
    marginBottom: 18
  },
  label: {
    fontSize: 12,
    color: "#6d745b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4
  },
  value: {
    fontSize: 16,
    color: "#1f2910",
    lineHeight: 22
  },
  meta: {
    marginTop: 8,
    fontSize: 11,
    color: "#999"
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9f8ea"
  },
  errorText: {
    color: "#b00020",
    textAlign: "center"
  }
});
