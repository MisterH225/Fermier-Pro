import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OfflineIdMappings, OfflineQueueItem } from "./types";
import {
  OFFLINE_ID_MAP_STORAGE_KEY,
  OFFLINE_QUEUE_STORAGE_KEY
} from "./types";

export async function loadOfflineQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as OfflineQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveOfflineQueue(items: OfflineQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(items));
}

export async function loadIdMappings(): Promise<OfflineIdMappings> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_ID_MAP_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as OfflineIdMappings;
  } catch {
    return {};
  }
}

export async function saveIdMappings(map: OfflineIdMappings): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_ID_MAP_STORAGE_KEY, JSON.stringify(map));
}

export async function clearOfflineStorage(): Promise<void> {
  await AsyncStorage.multiRemove([
    OFFLINE_QUEUE_STORAGE_KEY,
    OFFLINE_ID_MAP_STORAGE_KEY
  ]);
}
