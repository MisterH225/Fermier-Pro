import { useCallback, useState } from "react";
import type { AnimalListItem } from "../lib/api";

export function useCheptelAnimalActions() {
  const [transferAnimal, setTransferAnimal] = useState<AnimalListItem | null>(
    null
  );
  const [statusAnimal, setStatusAnimal] = useState<AnimalListItem | null>(null);
  const [saleAnimal, setSaleAnimal] = useState<AnimalListItem | null>(null);
  const [diseaseAnimal, setDiseaseAnimal] = useState<AnimalListItem | null>(null);
  const [weightAnimal, setWeightAnimal] = useState<AnimalListItem | null>(null);

  const clearAll = useCallback(() => {
    setTransferAnimal(null);
    setStatusAnimal(null);
    setSaleAnimal(null);
    setDiseaseAnimal(null);
    setWeightAnimal(null);
  }, []);

  return {
    transferAnimal,
    openTransfer: setTransferAnimal,
    closeTransfer: () => setTransferAnimal(null),
    statusAnimal,
    openStatus: setStatusAnimal,
    closeStatus: () => setStatusAnimal(null),
    saleAnimal,
    openSale: setSaleAnimal,
    closeSale: () => setSaleAnimal(null),
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
