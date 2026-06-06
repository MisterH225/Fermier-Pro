import * as SecureStore from "expo-secure-store";

const CHUNK_SIZE = 1800;

function chunkMetaKey(key: string): string {
  return `${key}__chunks`;
}

function chunkKey(key: string, index: number): string {
  return `${key}__${index}`;
}

async function readChunkCount(key: string): Promise<number> {
  const metaRaw = await SecureStore.getItemAsync(chunkMetaKey(key));
  if (!metaRaw) {
    return 0;
  }
  const count = Number.parseInt(metaRaw, 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

async function deleteChunks(
  key: string,
  fromIndex: number,
  toExclusive: number
): Promise<void> {
  for (let i = fromIndex; i < toExclusive; i += 1) {
    await SecureStore.deleteItemAsync(chunkKey(key, i));
  }
}

/**
 * Adaptateur Supabase auth compatible SecureStore (Keychain / Keystore).
 * Les sessions JWT dépassent souvent 2 Ko — stockage découpé en morceaux.
 */
export const supabaseSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const metaRaw = await SecureStore.getItemAsync(chunkMetaKey(key));
    if (!metaRaw) {
      return SecureStore.getItemAsync(key);
    }
    const count = Number.parseInt(metaRaw, 10);
    if (!Number.isFinite(count) || count < 1) {
      return null;
    }
    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part == null) {
        return null;
      }
      parts.push(part);
    }
    return parts.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    const priorChunkCount = await readChunkCount(key);

    if (value.length <= CHUNK_SIZE) {
      if (priorChunkCount > 0) {
        await deleteChunks(key, 0, priorChunkCount);
      }
      await SecureStore.deleteItemAsync(chunkMetaKey(key));
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < chunks; i += 1) {
      await SecureStore.setItemAsync(
        chunkKey(key, i),
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      );
    }
    if (priorChunkCount > chunks) {
      await deleteChunks(key, chunks, priorChunkCount);
    }
    await SecureStore.setItemAsync(chunkMetaKey(key), String(chunks));
    await SecureStore.deleteItemAsync(key);
  },

  async removeItem(key: string): Promise<void> {
    const priorChunkCount = await readChunkCount(key);
    if (priorChunkCount > 0) {
      await deleteChunks(key, 0, priorChunkCount);
      await SecureStore.deleteItemAsync(chunkMetaKey(key));
    }
    await SecureStore.deleteItemAsync(key);
  }
};
