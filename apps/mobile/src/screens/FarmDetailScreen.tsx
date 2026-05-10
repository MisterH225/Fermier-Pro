import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ensureFarmChatRoom, fetchFarm } from "../lib/api";
import { buildFarmDetailMenu } from "../lib/menuVisibility";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmDetail">;

export function FarmDetailScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();

  const farmQuery = useQuery({
    queryKey: ["farm", farmId, activeProfileId],
    queryFn: () => fetchFarm(accessToken, farmId, activeProfileId)
  });

  const openFarmChat = useMutation({
    mutationFn: () => ensureFarmChatRoom(accessToken, farmId, activeProfileId),
    onSuccess: (room) => {
      void qc.invalidateQueries({ queryKey: ["chatRooms", activeProfileId] });
      navigation.navigate("ChatRoom", {
        roomId: room.id,
        headline: room.farm?.name ?? farmName
      });
    }
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

  const menu = buildFarmDetailMenu(clientFeatures, farm.effectiveScopes);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {menu.livestock ? (
        <TouchableOpacity
          style={styles.cheptelCta}
          onPress={() =>
            navigation.navigate("FarmLivestock", { farmId, farmName })
          }
        >
          <Text style={styles.cheptelCtaText}>Voir le cheptel</Text>
          <Text style={styles.cheptelCtaSub}>Animaux et lots</Text>
        </TouchableOpacity>
      ) : null}

      {menu.chat ? (
        <>
          <TouchableOpacity
            style={styles.chatCta}
            onPress={() => openFarmChat.mutate()}
            disabled={openFarmChat.isPending}
          >
            <Text style={styles.chatCtaText}>Salon de la ferme</Text>
            <Text style={styles.chatCtaSub}>
              {openFarmChat.isPending
                ? "Ouverture…"
                : "Fil de discussion lié à cette exploitation"}
            </Text>
          </TouchableOpacity>
          {openFarmChat.isError ? (
            <Text style={styles.chatErr}>
              {openFarmChat.error instanceof Error
                ? openFarmChat.error.message
                : String(openFarmChat.error)}
            </Text>
          ) : null}
        </>
      ) : null}

      {menu.tasks ? (
        <TouchableOpacity
          style={styles.tasksCta}
          onPress={() =>
            navigation.navigate("FarmTasks", { farmId, farmName })
          }
        >
          <Text style={styles.tasksCtaText}>Tâches terrain</Text>
          <Text style={styles.tasksCtaSub}>Journal technicien</Text>
        </TouchableOpacity>
      ) : null}

      {menu.vetConsultations ? (
        <TouchableOpacity
          style={styles.vetCta}
          onPress={() =>
            navigation.navigate("FarmVetConsultations", { farmId, farmName })
          }
        >
          <Text style={styles.vetCtaText}>Suivi vétérinaire</Text>
          <Text style={styles.vetCtaSub}>Consultations et téléchargements</Text>
        </TouchableOpacity>
      ) : null}

      {menu.finance ? (
        <TouchableOpacity
          style={styles.financeCta}
          onPress={() =>
            navigation.navigate("FarmFinance", { farmId, farmName })
          }
        >
          <Text style={styles.financeCtaText}>Finance</Text>
          <Text style={styles.financeCtaSub}>Coûts et marges</Text>
        </TouchableOpacity>
      ) : null}

      {menu.housing ? (
        <TouchableOpacity
          style={styles.housingCta}
          onPress={() => navigation.navigate("FarmBarns", { farmId, farmName })}
        >
          <Text style={styles.housingCtaText}>Loges et parcours</Text>
          <Text style={styles.housingCtaSub}>Hébergement et chemins</Text>
        </TouchableOpacity>
      ) : null}

      {menu.marketplace ? (
        <TouchableOpacity
          style={styles.marketCta}
          onPress={() =>
            navigation.navigate("CreateMarketplaceListing", { farmId })
          }
        >
          <Text style={styles.marketCtaText}>Annonce sur le marché</Text>
          <Text style={styles.marketCtaSub}>
            Créer une annonce liée à cette ferme
          </Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.teamCta}
        onPress={() =>
          navigation.navigate("FarmMembers", {
            farmId,
            farmName,
            effectiveScopes: farm.effectiveScopes
          })
        }
      >
        <Text style={styles.teamCtaText}>Équipe et invitations</Text>
        <Text style={styles.teamCtaSub}>
          Membres, rôles et liens d&apos;invitation
        </Text>
      </TouchableOpacity>

      {menu.feedStock ? (
        <TouchableOpacity
          style={styles.feedCta}
          onPress={() =>
            navigation.navigate("FarmFeedStock", { farmId, farmName })
          }
        >
          <Text style={styles.feedCtaText}>Nutrition et stock</Text>
          <Text style={styles.feedCtaSub}>Aliments achetés, stock restant</Text>
        </TouchableOpacity>
      ) : null}

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
    marginBottom: 12
  },
  marketCta: {
    borderWidth: 2,
    borderColor: "#c4a574",
    backgroundColor: "#fdfaf3",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20
  },
  marketCtaText: {
    color: "#6b5420",
    fontSize: 17,
    fontWeight: "700"
  },
  marketCtaSub: {
    color: "#6d745b",
    fontSize: 13,
    marginTop: 4
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
  chatCta: {
    borderWidth: 2,
    borderColor: "#7a9a3a",
    backgroundColor: "#f0f5e4",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  chatCtaText: {
    color: "#3d5218",
    fontSize: 17,
    fontWeight: "700"
  },
  chatCtaSub: {
    color: "#6d745b",
    fontSize: 13,
    marginTop: 4
  },
  chatErr: {
    color: "#b00020",
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18
  },
  vetCta: {
    borderWidth: 2,
    borderColor: "#4a90a4",
    backgroundColor: "#eef6f8",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  vetCtaText: {
    color: "#2d5a6e",
    fontSize: 17,
    fontWeight: "700"
  },
  vetCtaSub: {
    color: "#6d745b",
    fontSize: 13,
    marginTop: 4
  },
  financeCta: {
    borderWidth: 2,
    borderColor: "#6b7cb8",
    backgroundColor: "#f2f4fb",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  financeCtaText: {
    color: "#3d4d78",
    fontSize: 17,
    fontWeight: "700"
  },
  financeCtaSub: {
    color: "#6d745b",
    fontSize: 13,
    marginTop: 4
  },
  housingCta: {
    borderWidth: 2,
    borderColor: "#a67c52",
    backgroundColor: "#faf6f0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  housingCtaText: {
    color: "#5c4428",
    fontSize: 17,
    fontWeight: "700"
  },
  housingCtaSub: {
    color: "#6d745b",
    fontSize: 13,
    marginTop: 4
  },
  teamCta: {
    borderWidth: 2,
    borderColor: "#6b6e9c",
    backgroundColor: "#f4f4fb",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  teamCtaText: {
    color: "#3a3d6b",
    fontSize: 17,
    fontWeight: "700"
  },
  teamCtaSub: {
    color: "#6d745b",
    fontSize: 13,
    marginTop: 4
  },
  feedCta: {
    borderWidth: 2,
    borderColor: "#8faa3c",
    backgroundColor: "#f6f9e8",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  feedCtaText: {
    color: "#4d6318",
    fontSize: 17,
    fontWeight: "700"
  },
  feedCtaSub: {
    color: "#6d745b",
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
