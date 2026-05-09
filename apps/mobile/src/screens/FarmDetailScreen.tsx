import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import type { FarmDto } from "../lib/api";
import { fetchFarm } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmDetail">;

export function FarmDetailScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId } = useSession();

  const farmQuery = useQuery({
    queryKey: ["farm", farmId, activeProfileId],
    queryFn: () => fetchFarm(accessToken, farmId, activeProfileId)
  });

  const farm = farmQuery.data;
  const error =
    farmQuery.error instanceof Error
      ? farmQuery.error.message
      : farmQuery.error
        ? String(farmQuery.error)
        : null;

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (farmQuery.isPending || !farm) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5d7a1f" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <TouchableOpacity
        style={styles.cheptelCta}
        onPress={() =>
          navigation.navigate("FarmLivestock", { farmId, farmName })
        }
      >
        <Text style={styles.cheptelCtaText}>Voir le cheptel</Text>
        <Text style={styles.cheptelCtaSub}>Animaux et lots</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tasksCta}
        onPress={() =>
          navigation.navigate("FarmTasks", { farmId, farmName })
        }
      >
        <Text style={styles.tasksCtaText}>Tâches terrain</Text>
        <Text style={styles.tasksCtaSub}>Journal technicien</Text>
      </TouchableOpacity>

      <FarmInfoBlocks farm={farm} />
    </ScrollView>
  );
}

function FarmInfoBlocks({ farm }: { farm: FarmDto }) {
  return (
    <>
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
    </>
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
  cheptelCta: {
    backgroundColor: "#5d7a1f",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  tasksCta: {
    borderWidth: 2,
    borderColor: "#5d7a1f",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20
  },
  tasksCtaText: {
    color: "#5d7a1f",
    fontSize: 17,
    fontWeight: "700"
  },
  tasksCtaSub: {
    color: "#6d745b",
    fontSize: 13,
    marginTop: 4
  },
  cheptelCtaText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700"
  },
  cheptelCtaSub: {
    color: "#dfe8c8",
    fontSize: 13,
    marginTop: 4
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
