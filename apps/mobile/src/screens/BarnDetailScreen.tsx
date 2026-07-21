import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { CreateLogeModal } from "../components/cheptel/pens/CreateLogeModal";
import { HousingModuleGate } from "../components/HousingModuleGate";
import { TechFarmAccessGate } from "../components/technician/TechFarmAccessGate";
import { useSession } from "../context/SessionContext";
import { fetchFarmBarn } from "../lib/api";
import { resolvePenOccupancy } from "../lib/penOccupancy";
import { getQueryErrorMessage } from "../lib/userFacingError";
import type { RootStackParamList } from "../types/navigation";
import { mobileColors, mobileRadius, mobileFontSize } from "../theme/mobileTheme";
import { producerColors } from "../theme/producerTheme";

type Props = NativeStackScreenProps<RootStackParamList, "BarnDetail">;

export function BarnDetailScreen({ route, navigation }: Props) {
  const { clientFeatures } = useSession();
  const { farmId } = route.params;

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
        <BarnDetailContent
          route={route}
          navigation={navigation}
          readOnly={readOnly}
        />
      )}
    </TechFarmAccessGate>
  );
}

function BarnDetailContent({
  route,
  navigation,
  readOnly
}: {
  route: Props["route"];
  navigation: Props["navigation"];
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const { farmId, farmName, barnId, barnName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const [createOpen, setCreateOpen] = useState(false);

  const q = useQuery({
    queryKey: ["farmBarn", farmId, barnId, activeProfileId],
    queryFn: () => fetchFarmBarn(accessToken, farmId, barnId, activeProfileId),
    enabled: clientFeatures.housing
  });

  const barn = q.data;

  useLayoutEffect(() => {
    const title = barn?.name ?? barnName ?? "Bâtiment";
    navigation.setOptions({
      title,
      headerRight:
        clientFeatures.housing && !readOnly
          ? () => (
              <TouchableOpacity
                onPress={() => setCreateOpen(true)}
                style={styles.headerBtn}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              >
                <Text style={styles.headerBtnText}>+ Loge</Text>
              </TouchableOpacity>
            )
          : undefined
    });
  }, [
    navigation,
    barn?.name,
    barnName,
    farmId,
    farmName,
    barnId,
    clientFeatures.housing,
    readOnly
  ]);

  if (q.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  const err =
    getQueryErrorMessage(q.error, t);

  if (err || !barn) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err ?? "Bâtiment introuvable."}</Text>
      </View>
    );
  }

  const pens = barn.pens ?? [];

  return (
    <View style={styles.flex}>
      {barn.notes ? (
        <Text style={styles.notes}>{barn.notes}</Text>
      ) : null}

      <FlatList
        data={pens}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          pens.length === 0 ? styles.emptyList : styles.list
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
            <Text style={styles.emptyTitle}>Aucune loge</Text>
            <Text style={styles.emptySub}>
              Ajoute des loges à ce bâtiment depuis les outils de gestion ou
              l’API.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate("PenDetail", {
                farmId,
                farmName,
                penId: item.id,
                penLabel: item.name
              })
            }
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            {item.zoneLabel ? (
              <Text style={styles.cardMeta}>Zone : {item.zoneLabel}</Text>
            ) : null}
            <Text style={styles.cardMeta}>
              Occupation active : {resolvePenOccupancy(item)}
              {item.capacity != null
                ? ` · Capacité ${item.capacity}`
                : ""}
            </Text>
            <Text style={styles.cardStatus}>Statut : {item.status}</Text>
          </TouchableOpacity>
        )}
      />

      <CreateLogeModal
        visible={createOpen}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        barns={[{ id: barnId, name: barn?.name ?? barnName ?? "Bâtiment" }]}
        defaultBarnId={barnId}
        lockBarn
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void q.refetch();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: mobileColors.canvas },
  notes: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: mobileFontSize.md,
    color: producerColors.oliveInk,
    lineHeight: 20
  },
  list: { padding: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: mobileColors.canvas
  },
  error: { color: producerColors.accent, textAlign: "center" },
  emptyBox: { padding: 32 },
  emptyTitle: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: producerColors.oliveDark,
    marginBottom: 8
  },
  emptySub: { fontSize: mobileFontSize.md, color: producerColors.oliveMuted, lineHeight: 20 },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: producerColors.oliveBorderWarm
  },
  cardTitle: { fontSize: mobileFontSize.lg, fontWeight: "700", color: producerColors.oliveDark },
  cardMeta: { fontSize: mobileFontSize.md, color: producerColors.oliveMuted, marginTop: 6 },
  cardStatus: { fontSize: mobileFontSize.sm, color: mobileColors.accent, marginTop: 8 },
  headerBtn: { marginRight: 4 },
  headerBtnText: { color: mobileColors.accent, fontWeight: "600", fontSize: mobileFontSize.md }
});
