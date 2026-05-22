/**
 * Polyfills pour PKCE Supabase (SHA-256) sous React Native / Expo.
 * Sans cela : « WebCrypto API is not supported » et « invalid flow state ».
 */
import "react-native-get-random-values";
import * as ExpoCrypto from "expo-crypto";

type CryptoLike = {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  subtle: {
    digest(
      algorithm: AlgorithmIdentifier,
      data: BufferSource
    ): Promise<ArrayBuffer>;
  };
};

function ensureCrypto(): void {
  const g = globalThis as Record<string, unknown>;
  const existing = g.crypto as CryptoLike | undefined;
  const crypto: CryptoLike = existing ?? ({} as CryptoLike);
  g.crypto = crypto;

  if (typeof crypto.getRandomValues !== "function") {
    crypto.getRandomValues = <T extends ArrayBufferView>(array: T): T => {
      const bytes = ExpoCrypto.getRandomBytes(array.byteLength);
      const view = new Uint8Array(
        array.buffer,
        array.byteOffset,
        array.byteLength
      );
      view.set(bytes);
      return array;
    };
  }

  if (!crypto.subtle?.digest) {
    crypto.subtle = {
      async digest(
        algorithm: AlgorithmIdentifier,
        data: BufferSource
      ): Promise<ArrayBuffer> {
        const name =
          typeof algorithm === "string"
            ? algorithm
            : (algorithm as Algorithm).name;
        if (name !== "SHA-256") {
          throw new Error(`Unsupported digest: ${name}`);
        }
        return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
      }
    };
  }
}

ensureCrypto();
