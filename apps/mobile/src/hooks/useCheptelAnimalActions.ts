import { useCallback, useState } from "react";
import type { AnimalStatusKey } from "../components/cheptel/animals/animalUtils";
import type { AnimalListItem } from "../lib/api";

export function useCheptelAnimalActions() {
  const [transferAnimal, setTransferAnimal] = useState<AnimalListItem | null>(
    null
  );
  const [statusAnimal, setStatusAnimal] = useState<AnimalListItem | null>(null);
  const [statusPreset, setStatusPreset] = useState<AnimalStatusKey | undefined>(
    undefined
  );
  const [saleAnimal, setSaleAnimal] = useState<AnimalListItem | null>(null);
  const [sellChooserAnimal, setSellChooserAnimal] =
    useState<AnimalListItem | null>(null);
  const [diseaseAnimal, setDiseaseAnimal] = useState<AnimalListItem | null>(null);
  const [weightAnimal, setWeightAnimal] = useState<AnimalListItem | null>(null);

  const clearAll = useCallback(() => {
    setTransferAnimal(null);
    setStatusAnimal(null);
    setStatusPreset(undefined);
    setSaleAnimal(null);
    setSellChooserAnimal(null);
    setDiseaseAnimal(null);
    setWeightAnimal(null);
  }, []);

  const openStatus = useCallback(
    (animal: AnimalListItem, preset?: AnimalStatusKey) => {
      setStatusPreset(preset);
      setStatusAnimal(animal);
    },
    []
  );

  const closeStatus = useCallback(() => {
    setStatusAnimal(null);
    setStatusPreset(undefined);
  }, []);

  return {
    transferAnimal,
    openTransfer: setTransferAnimal,
    closeTransfer: () => setTransferAnimal(null),
    statusAnimal,
    statusPreset,
    openStatus,
    closeStatus,
    saleAnimal,
    openSale: setSaleAnimal,
    closeSale: () => setSaleAnimal(null),
    sellChooserAnimal,
    openSellChooser: setSellChooserAnimal,
    closeSellChooser: () => setSellChooserAnimal(null),
    diseaseAnimal,
    openDisease: setDiseaseAnimal,
    closeDisease: () => setDiseaseAnimal(null),
    weightAnimal,
    openWeight: setWeightAnimal,
    closeWeight: () => setWeightAnimal(null),
    clearAll
  };
}

export type CheptelAnimalActions = ReturnType<typeof useCheptelAnimalActions>;
