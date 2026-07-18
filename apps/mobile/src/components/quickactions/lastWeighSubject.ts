import AsyncStorage from "@react-native-async-storage/async-storage";

const keyForFarm = (farmId: string) => `fermier:lastWeighSubject:${farmId}`;

export type LastWeighSubject = {
  animalId?: string;
  batchId?: string;
};

export async function readLastWeighSubject(
  farmId: string
): Promise<LastWeighSubject | null> {
  try {
    const raw = await AsyncStorage.getItem(keyForFarm(farmId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as LastWeighSubject;
    if (
      typeof parsed !== "object" ||
      parsed == null ||
      (parsed.animalId == null && parsed.batchId == null)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeLastWeighSubject(
  farmId: string,
  subject: LastWeighSubject
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyForFarm(farmId), JSON.stringify(subject));
  } catch {
    // ignore persistence failures
  }
}
