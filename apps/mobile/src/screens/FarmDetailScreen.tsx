import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mobileColors, mobileRadius, mobileFontSize } from "../theme/mobileTheme";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
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
import { getQueryErrorMessage, getUserFacingError } from "../lib/userFacingError";
import { marketplaceColors } from "../theme/marketplaceTheme";
import { producerColors } from "../theme/producerTheme";

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
    case "Collaboration":
      navigation.navigate("Collaboration", row.params);
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
  const { t } = useTranslation();
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
      ? getUserFacingError(farmQuery.error, t)
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
        <ActivityIndicator size="large" color={mobileColors.accent} />
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
                      ? getUserFacingError(openFarmChat.error, t)
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
    backgroundColor: mobileColors.canvas
  },
  content: {
    padding: 16,
    paddingBottom: 32
  },
  cheptelCta: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.lg,
    padding: 16,
    marginBottom: 12
  },
  tasksCta: {
    borderWidth: 2,
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: 16,
    marginBottom: 12
  },
  marketCta: {
    borderWidth: 2,
    borderColor: marketplaceColors.handover,
    backgroundColor: producerColors.oliveCard,
    borderRadius: mobileRadius.lg,
    padding: 16,
    marginBottom: 20
  },
  marketCtaText: {
    color: producerColors.oliveClosedText,
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  },
  marketCtaSub: {
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm,
    marginTop: 4
  },
  tasksCtaText: {
    color: mobileColors.accent,
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  },
  tasksCtaSub: {
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm,
    marginTop: 4
  },
  cheptelCtaText: {
    color: mobileColors.onAccent,
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  },
  cheptelCtaSub: {
    color: producerColors.primaryMuted,
    fontSize: mobileFontSize.sm,
    marginTop: 4
  },
  chatCta: {
    borderWidth: 2,
    borderColor: producerColors.primarySoft,
    backgroundColor: producerColors.oliveWash,
    borderRadius: mobileRadius.lg,
    padding: 16,
    marginBottom: 12
  },
  chatCtaText: {
    color: producerColors.primaryDark,
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  },
  chatCtaSub: {
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm,
    marginTop: 4
  },
  chatErr: {
    color: producerColors.dangerDeep,
    fontSize: mobileFontSize.sm,
    marginBottom: 12,
    lineHeight: 18
  },
  vetCta: {
    borderWidth: 2,
    borderColor: producerColors.moduleTealBorder,
    backgroundColor: producerColors.moduleTealBg,
    borderRadius: mobileRadius.lg,
    padding: 16,
    marginBottom: 12
  },
  vetCtaText: {
    color: marketplaceColors.reservedText,
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  },
  vetCtaSub: {
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm,
    marginTop: 4
  },
  financeCta: {
    borderWidth: 2,
    borderColor: producerColors.moduleIndigoBorder,
    backgroundColor: producerColors.moduleIndigoBg,
    borderRadius: mobileRadius.lg,
    padding: 16,
    marginBottom: 12
  },
  financeCtaText: {
    color: producerColors.moduleIndigoText,
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  },
  financeCtaSub: {
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm,
    marginTop: 4
  },
  housingCta: {
    borderWidth: 2,
    borderColor: producerColors.moduleBrownBorder,
    backgroundColor: producerColors.oliveCard,
    borderRadius: mobileRadius.lg,
    padding: 16,
    marginBottom: 12
  },
  housingCtaText: {
    color: producerColors.moduleBrownText,
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  },
  housingCtaSub: {
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm,
    marginTop: 4
  },
  teamCta: {
    borderWidth: 2,
    borderColor: producerColors.moduleSlateBorder,
    backgroundColor: producerColors.moduleSlateBg,
    borderRadius: mobileRadius.lg,
    padding: 16,
    marginBottom: 12
  },
  teamCtaText: {
    color: producerColors.moduleSlateText,
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  },
  teamCtaSub: {
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm,
    marginTop: 4
  },
  feedCta: {
    borderWidth: 2,
    borderColor: producerColors.moduleLimeBorder,
    backgroundColor: producerColors.oliveCanvas,
    borderRadius: mobileRadius.lg,
    padding: 16,
    marginBottom: 12
  },
  feedCtaText: {
    color: producerColors.moduleLimeText,
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  },
  feedCtaSub: {
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm,
    marginTop: 4
  },
  block: {
    marginBottom: 18
  },
  label: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4
  },
  value: {
    fontSize: mobileFontSize.lg,
    color: mobileColors.textPrimary,
    lineHeight: 22
  },
  meta: {
    marginTop: 8,
    fontSize: mobileFontSize.xs,
    color: marketplaceColors.placeholder
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: mobileColors.canvas
  },
  errorText: {
    color: producerColors.dangerDeep,
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
