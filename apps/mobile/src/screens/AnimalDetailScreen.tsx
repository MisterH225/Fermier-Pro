import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View
} from "react-native";
import { AnimalDetailModal } from "../components/cheptel/animals/AnimalDetailModal";
import { CheptelAnimalActionModals } from "../components/cheptel/animals/CheptelAnimalActionModals";
import {
  animalStatusForExitKind,
  type LivestockExitKind
} from "../components/cheptel/exits/livestockExitKind";
import { useSession } from "../context/SessionContext";
import { useCheptelAnimalActions } from "../hooks/useCheptelAnimalActions";
import { useScreenTitle } from "../hooks/useScreenTitle";
import { fetchFarmAnimals } from "../lib/api";
import type { AnimalListItem } from "../lib/api";
import {
  CHEPTEL_ANIMAL_MUTATION_ROOTS,
  invalidateCheptelCaches
} from "../lib/cheptelQueries";
import { getUserFacingError } from "../lib/userFacingError";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "AnimalDetail">;

export function AnimalDetailScreen({ route, navigation }: Props) {
  const { farmId, farmName, animalId } = route.params;
  const { accessToken, activeProfileId } = useSession();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const animalActions = useCheptelAnimalActions();

  const animalsQuery = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const animal = useMemo(
    () => animalsQuery.data?.find((a) => a.id === animalId) ?? null,
    [animalsQuery.data, animalId]
  );

  useScreenTitle(navigation, t("navigation.screenTitles.animalDetail"));

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ["farmAnimal", farmId, animalId]
    });
    invalidateCheptelCaches(queryClient, farmId, CHEPTEL_ANIMAL_MUTATION_ROOTS);
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
        ? getUserFacingError(animalsQuery.error, t)
        : animalsQuery.error
          ? String(animalsQuery.error)
          : null;
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err || "Animal introuvable."}</Text>
      </View>
    );
  }

  const openAction =
    (setter: (animal: AnimalListItem) => void) => (a: AnimalListItem) =>
      setter(a);

  const onExitVerb = (a: AnimalListItem, kind: LivestockExitKind) => {
    if (kind === "sale") {
      animalActions.openSellChooser(a);
      return;
    }
    animalActions.openStatus(a, animalStatusForExitKind(kind));
  };

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
        onTransfer={openAction(animalActions.openTransfer)}
        onExitVerb={onExitVerb}
        onAddWeight={openAction(animalActions.openWeight)}
        onOpenHealth={() =>
          navigation.navigate("FarmHealth", { farmId, farmName })
        }
      />

      <CheptelAnimalActionModals
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        animals={animalsQuery.data ?? []}
        actions={animalActions}
        onInvalidate={invalidate}
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
