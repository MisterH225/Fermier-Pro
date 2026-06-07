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
import { AddWeightModal } from "../components/cheptel/weight/AddWeightModal";
import { ChangeStatusModal } from "../components/cheptel/animals/ChangeStatusModal";
import { SaleModal, type SaleResult } from "../components/cheptel/animals/SaleModal";
import { DiseaseModal } from "../components/shared/DiseaseModal";
import { TransferModal } from "../components/cheptel/animals/TransferModal";
import { useModal } from "../components/modals/useModal";
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
import { getQueryErrorMessage, getUserFacingError } from "../lib/userFacingError";

type Props = NativeStackScreenProps<RootStackParamList, "AnimalDetail">;

export function AnimalDetailScreen({ route, navigation }: Props) {
  const { farmId, farmName, animalId } = route.params;
  const { accessToken, activeProfileId } = useSession();
  const { t } = useTranslation();
  const { open } = useModal();
  const queryClient = useQueryClient();

  const [transferAnimal, setTransferAnimal] = useState<AnimalListItem | null>(
    null
  );
  const [statusAnimal, setStatusAnimal] = useState<AnimalListItem | null>(null);
  const [saleAnimal, setSaleAnimal] = useState<AnimalListItem | null>(null);
  const [diseaseAnimal, setDiseaseAnimal] = useState<AnimalListItem | null>(null);
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

  useScreenTitle(navigation, t("navigation.screenTitles.animalDetail"));

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
        onListForSale={(a) => setSaleAnimal(a)}
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
        onRequestSale={(a) => setSaleAnimal(a)}
        onRequestDisease={(a) => setDiseaseAnimal(a)}
      />

      <DiseaseModal
        visible={Boolean(diseaseAnimal)}
        presetAnimal={diseaseAnimal}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onClose={() => setDiseaseAnimal(null)}
        onSuccess={invalidate}
      />

      <SaleModal
        visible={Boolean(saleAnimal)}
        animal={saleAnimal}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onCancel={() => setSaleAnimal(null)}
        onSuccess={(sale: SaleResult) => {
          setSaleAnimal(null);
          invalidate();
          const tag =
            sale.animal.tagCode?.trim() ||
            sale.animal.publicId?.slice(0, 8) ||
            "—";
          const amount = Number(sale.transaction.amount);
          open("success", {
            title: t("cheptel.animals.sale.successTitle"),
            message: t("cheptel.animals.sale.successMessage", {
              tag,
              amount: amount.toLocaleString("fr-FR"),
              currency: sale.transaction.currency
            }),
            autoDismissMs: 3500
          });
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
