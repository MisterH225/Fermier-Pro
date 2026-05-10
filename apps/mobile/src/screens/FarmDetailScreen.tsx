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
import {
  buildFarmDetailMenuItems,
  type FarmDetailMenuNavigateRow,
  type FarmDetailMenuPreset
} from "../features/farm-detail-menu";
import type { FarmDto } from "../lib/api";
import { ensureFarmChatRoom, fetchFarm } from "../lib/api";
import { buildFarmDetailMenu } from "../lib/menuVisibility";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmDetail">;

function navigateFarmDetailRow(
  navigation: Props["navigation"],
  row: FarmDetailMenuNavigateRow
): void {
  switch (row.screen) {
    case "FarmLivestock":
      navigation.navigate("FarmLivestock", row.params);
      return;
    case "FarmTasks":
      navigation.navigate("FarmTasks", row.params);
      return;
    case "FarmVetConsultations":
      navigation.navigate("FarmVetConsultations", row.params);
      return;
    case "FarmFinance":
      navigation.navigate("FarmFinance", row.params);
      return;
    case "FarmBarns":
      navigation.navigate("FarmBarns", row.params);
      return;
    case "CreateMarketplaceListing":
      navigation.navigate("CreateMarketplaceListing", row.params);
      return;
    case "FarmMembers":
      navigation.navigate("FarmMembers", row.params);
      return;
    case "FarmFeedStock":
      navigation.navigate("FarmFeedStock", row.params);
      return;
    default: {
      const _exhaustive: never = row;
      void _exhaustive;
    }
  }
}

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
  const menuRows = buildFarmDetailMenuItems({
    menu,
    farmId,
    farmName,
    effectiveScopes: farm.effectiveScopes
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {menuRows
        .filter((row) => row.visible)
        .map((row) => {
          if (row.kind === "farmChat") {
            return (
              <View key="farmChat">
                <TouchableOpacity
                  style={styles.chatCta}
                  onPress={() => openFarmChat.mutate()}
                  disabled={openFarmChat.isPending}
                >
                  <Text style={styles.chatCtaText}>{row.title}</Text>
                  <Text style={styles.chatCtaSub}>
                    {openFarmChat.isPending
                      ? row.subtitlePending
                      : row.subtitleIdle}
                  </Text>
                </TouchableOpacity>
                {openFarmChat.isError ? (
                  <Text style={styles.chatErr}>
                    {openFarmChat.error instanceof Error
                      ? openFarmChat.error.message
                      : String(openFarmChat.error)}
                  </Text>
                ) : null}
              </View>
            );
          }

          const ps = MENU_PRESET_STYLES[row.preset];
          return (
            <TouchableOpacity
              key={`${row.screen}-${row.preset}`}
              style={ps.box}
              onPress={() => navigateFarmDetailRow(navigation, row)}
            >
              <Text style={ps.title}>{row.title}</Text>
              <Text style={ps.sub}>{row.subtitle}</Text>
            </TouchableOpacity>
          );
        })}

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

const MENU_PRESET_STYLES: Record<
  FarmDetailMenuPreset,
  { box: object; title: object; sub: object }
> = {
  cheptel: {
    box: styles.cheptelCta,
    title: styles.cheptelCtaText,
    sub: styles.cheptelCtaSub
  },
  tasks: {
    box: styles.tasksCta,
    title: styles.tasksCtaText,
    sub: styles.tasksCtaSub
  },
  chat: {
    box: styles.chatCta,
    title: styles.chatCtaText,
    sub: styles.chatCtaSub
  },
  vet: {
    box: styles.vetCta,
    title: styles.vetCtaText,
    sub: styles.vetCtaSub
  },
  finance: {
    box: styles.financeCta,
    title: styles.financeCtaText,
    sub: styles.financeCtaSub
  },
  housing: {
    box: styles.housingCta,
    title: styles.housingCtaText,
    sub: styles.housingCtaSub
  },
  market: {
    box: styles.marketCta,
    title: styles.marketCtaText,
    sub: styles.marketCtaSub
  },
  team: {
    box: styles.teamCta,
    title: styles.teamCtaText,
    sub: styles.teamCtaSub
  },
  feed: {
    box: styles.feedCta,
    title: styles.feedCtaText,
    sub: styles.feedCtaSub
  }
};
