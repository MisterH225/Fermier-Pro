import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View
} from "react-native";
import { AnimalDetailModal } from "../components/cheptel/animals/AnimalDetailModal";
import { AddWeightModal } from "../components/cheptel/weight/AddWeightModal";
import { ChangeStatusModal } from "../components/cheptel/animals/ChangeStatusModal";
import { TransferModal } from "../components/cheptel/animals/TransferModal";
import { animalDisplayTag } from "../components/cheptel/animals/animalUtils";
import { useSession } from "../context/SessionContext";
import { useScreenTitle } from "../hooks/useScreenTitle";
import { fetchFarmAnimals } from "../lib/api";
import type { AnimalListItem } from "../lib/api";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";
import { useState } from "react";

type Props = NativeStackScreenProps<RootStackParamList, "AnimalDetail">;

export function AnimalDetailScreen({ route, navigation }: Props) {
  const { farmId, farmName, animalId, headline } = route.params;
  const { accessToken, activeProfileId } = useSession();
  const queryClient = useQueryClient();

  const [transferAnimal, setTransferAnimal] = useState<AnimalListItem | null>(
    null
  );
  const [statusAnimal, setStatusAnimal] = useState<AnimalListItem | null>(null);
  const [weightAnimal, setWeightAnimal] = useState<AnimalListItem | null>(null);

  const animalsQuery = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const animal = useMemo(
    () => animalsQuery.data?.find((a) => a.id === animalId) ?? null,
    [animalsQuery.data, animalId]
  );

  const screenTitle =
    headline?.trim() ||
    (animal ? animalDisplayTag(animal) : "Animal");

  useScreenTitle(navigation, screenTitle);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ["farmAnimal", farmId, animalId]
    });
    void queryClient.invalidateQueries({ queryKey: ["farmAnimals", farmId] });
    void queryClient.invalidateQueries({ queryKey: ["penContents", farmId] });
    void queryClient.invalidateQueries({ queryKey: ["cheptelPens", farmId] });
  };

  if (animalsQuery.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  if (animalsQuery.error || !animal) {
    const err =
      animalsQuery.error instanceof Error
        ? animalsQuery.error.message
        : animalsQuery.error
          ? String(animalsQuery.error)
          : null;
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err || "Animal introuvable."}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AnimalDetailModal
        presentation="page"
        visible
        animal={animal}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onClose={() => navigation.goBack()}
        onUpdated={invalidate}
        onTransfer={(a) => setTransferAnimal(a)}
        onChangeStatus={(a) => setStatusAnimal(a)}
        onAddWeight={(a) => setWeightAnimal(a)}
        onOpenHealth={() =>
          navigation.navigate("FarmHealth", { farmId, farmName })
        }
      />

      <ChangeStatusModal
        visible={Boolean(statusAnimal)}
        animal={statusAnimal}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onClose={() => setStatusAnimal(null)}
        onUpdated={() => {
          setStatusAnimal(null);
          invalidate();
        }}
      />

      <TransferModal
        visible={Boolean(transferAnimal)}
        initialAnimalId={transferAnimal?.id}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        animals={animalsQuery.data ?? []}
        onClose={() => setTransferAnimal(null)}
        onTransferred={() => {
          setTransferAnimal(null);
          invalidate();
        }}
      />

      <AddWeightModal
        visible={Boolean(weightAnimal)}
        preselectedAnimalId={weightAnimal?.id}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onClose={() => setWeightAnimal(null)}
        onSaved={() => {
          setWeightAnimal(null);
          invalidate();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mobileColors.canvas },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.lg,
    backgroundColor: mobileColors.canvas
  },
  error: {
    ...mobileTypography.body,
    color: mobileColors.error,
    textAlign: "center"
  }
});
