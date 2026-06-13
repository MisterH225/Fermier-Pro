import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useScreenTitle } from "../hooks/useScreenTitle";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { CreateBuildingModal } from "../components/cheptel/pens/CreateBuildingModal";
import { HousingModuleGate } from "../components/HousingModuleGate";
import { TechFarmAccessGate } from "../components/technician/TechFarmAccessGate";
import { useSession } from "../context/SessionContext";
import { fetchFarmBarns } from "../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmBarns">;

export function FarmBarnsScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { t } = useTranslation();
  const { accessToken, activeProfileId, clientFeatures } = useSession();

  const q = useQuery({
    queryKey: ["farmBarns", farmId, activeProfileId],
    queryFn: () => fetchFarmBarns(accessToken, farmId, activeProfileId),
    enabled: clientFeatures.housing
  });

  useFocusEffect(
    useCallback(() => {
      void q.refetch();
    }, [q.refetch])
  );

  if (!clientFeatures.housing) {
    return (
      <HousingModuleGate>
        <View />
      </HousingModuleGate>
    );
  }

  return (
    <TechFarmAccessGate farmId={farmId} module="loges">
      {({ readOnly }) => (
        <FarmBarnsContent
          farmId={farmId}
          farmName={farmName}
          navigation={navigation}
          readOnly={readOnly}
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          q={q}
          t={t}
        />
      )}
    </TechFarmAccessGate>
  );
}

function FarmBarnsContent({
  farmId,
  farmName,
  navigation,
  readOnly,
  accessToken,
  activeProfileId,
  q,
  t
}: {
  farmId: string;
  farmName: string;
  navigation: Props["navigation"];
  readOnly: boolean;
  accessToken: string;
  activeProfileId?: string | null;
  q: ReturnType<typeof useQuery<Awaited<ReturnType<typeof fetchFarmBarns>>>>;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const { clientFeatures } = useSession();
  const [createOpen, setCreateOpen] = useState(false);

  useScreenTitle(navigation, t("navigation.screenTitles.barns"), {
    headerRight:
      clientFeatures.housing && !readOnly
        ? () => (
            <TouchableOpacity
              onPress={() => setCreateOpen(true)}
              style={styles.headerBtn}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={styles.headerBtnText}>+ Bâtiment</Text>
            </TouchableOpacity>
          )
        : undefined
  });

  if (q.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  const err =
    q.error instanceof Error ? q.error.message : q.error ? String(q.error) : null;

  if (err) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err}</Text>
        <Text style={styles.hint}>
          Scopes requis : housing.read sur cette ferme.
        </Text>
      </View>
    );
  }

  const barns = q.data ?? [];

  return (
    <View style={styles.flex}>
      <FlatList
        data={barns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          barns.length === 0 ? styles.emptyList : styles.list
        }
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => void q.refetch()}
            tintColor={mobileColors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Aucun bâtiment</Text>
            <Text style={styles.emptySub}>
              Appuyez sur « + Bâtiment » pour créer un bâtiment et ses loges.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate("BarnDetail", {
                farmId,
                farmName,
                barnId: item.id,
                barnName: item.name
              })
            }
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            {item.code ? (
              <Text style={styles.cardMeta}>Code : {item.code}</Text>
            ) : null}
            <Text style={styles.cardMeta}>
              {item._count.pens} loge{item._count.pens === 1 ? "" : "s"}
            </Text>
          </TouchableOpacity>
        )}
      />
      <CreateBuildingModal
        visible={createOpen}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void q.refetch()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: mobileColors.canvas },
  list: { padding: mobileSpacing.lg, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.xl,
    backgroundColor: mobileColors.canvas
  },
  error: { color: mobileColors.error, textAlign: "center", marginBottom: 8 },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  emptyBox: { padding: 32 },
  emptyTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginBottom: 8
  },
  emptySub: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    lineHeight: 20
  },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  cardTitle: { ...mobileTypography.cardTitle, color: mobileColors.textPrimary },
  cardMeta: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginTop: 6
  },
  headerBtn: { marginRight: 4 },
  headerBtnText: { color: mobileColors.accent, fontWeight: "600", fontSize: 15 }
});
