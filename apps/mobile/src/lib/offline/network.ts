/** Erreur réseau / API injoignable (pas une erreur métier 4xx/5xx JSON). */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) {
    const m = err.message.toLowerCase();
    return (
      m.includes("network request failed") ||
      m.includes("failed to fetch") ||
      m.includes("network error")
    );
  }
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return (
      m.includes("network request failed") ||
      m.includes("failed to fetch") ||
      m === "network error" ||
      m.includes("econnrefused") ||
      m.includes("timeout") ||
      m.includes("aborted")
    );
  }
  return false;
}
