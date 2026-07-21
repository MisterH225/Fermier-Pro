import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mobileColors, mobileRadius, mobileFontSize } from "../theme/mobileTheme";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { ChatModuleGate } from "../components/ChatModuleGate";
import { SurfaceCard } from "../components/common/SurfaceCard";
import { producerPalette } from "../components/common/rolePalette";
import { useSession } from "../context/SessionContext";
import { fetchFarms } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";
import { getQueryErrorMessage, getUserFacingError } from "../lib/userFacingError";
import { producerColors } from "../theme/producerTheme";

type Props = NativeStackScreenProps<RootStackParamList, "ChatPickFarm">;

export function ChatPickFarmScreen({ navigation }: Props) {
  const { t } = useTranslation();
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
            <ActivityIndicator size="large" color={mobileColors.accent} />
          </View>
        ) : farmsQuery.error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>
              {farmsQuery.error instanceof Error
                ? getUserFacingError(farmsQuery.error, t)
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
              <SurfaceCard
                palette={producerPalette}
                style={{ borderColor: producerColors.oliveBorder }}
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
              </SurfaceCard>
            )}
          />
        )}
      </View>
    </ChatModuleGate>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: mobileColors.canvas },
  intro: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    fontSize: mobileFontSize.md,
    color: mobileColors.textTertiary,
    lineHeight: 20
  },
  searchCta: {
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: mobileRadius.lg,
    borderWidth: 2,
    borderColor: producerColors.primarySoft,
    backgroundColor: producerColors.oliveWash
  },
  searchCtaText: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: producerColors.primaryDark
  },
  searchCtaSub: {
    marginTop: 6,
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    lineHeight: 18
  },
  list: { padding: 16, paddingBottom: 32 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  cardTitle: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  cardSub: {
    marginTop: 6,
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary
  },
  error: { color: producerColors.dangerDeep, textAlign: "center" },
  empty: { fontSize: mobileFontSize.md, color: mobileColors.textSecondary, textAlign: "center" }
});
