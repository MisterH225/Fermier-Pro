import AsyncStorage from "@react-native-async-storage/async-storage";

function key(kind: string, id: string): string {
  return `crossRating:done:${kind}:${id}`;
}

export async function wasCrossRatingDismissed(
  kind: string,
  id: string
): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(key(kind, id));
    return v === "1";
  } catch {
    return false;
  }
}

export async function markCrossRatingDismissed(
  kind: string,
  id: string
): Promise<void> {
  try {
    await AsyncStorage.setItem(key(kind, id), "1");
  } catch {
    // ignore
  }
}
