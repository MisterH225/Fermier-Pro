import { apiBaseUrl } from "./http";

export type InsightI18nRef = {
  key: string;
  params?: Record<string, string | number>;
};

export type InsightDto = {
  kind: "first" | "delta" | "compare" | "info";
  headline: InsightI18nRef;
  detail?: InsightI18nRef;
};

const INSIGHT_TIMEOUT_MS = 2000;

async function fetchInsight(
  path: string,
  accessToken: string,
  activeProfileId?: string | null
): Promise<InsightDto | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INSIGHT_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    };
    if (activeProfileId?.trim()) {
      headers["X-Profile-Id"] = activeProfileId.trim();
    }
    const res = await fetch(`${apiBaseUrl()}${path}`, {
      method: "GET",
      headers,
      signal: controller.signal,
      cache: "no-store"
    });
    if (res.status === 204) {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as InsightDto;
  } catch {
    // Timeout / réseau : jamais bloquant
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function fetchAfterWeighingInsight(
  accessToken: string,
  farmId: string,
  params: { animalId?: string; batchId?: string },
  activeProfileId?: string | null
): Promise<InsightDto | null> {
  const q = params.animalId
    ? `animalId=${encodeURIComponent(params.animalId)}`
    : `batchId=${encodeURIComponent(params.batchId ?? "")}`;
  return fetchInsight(
    `/farms/${farmId}/insights/after-weighing?${q}`,
    accessToken,
    activeProfileId
  );
}

export function fetchAfterSaleInsight(
  accessToken: string,
  farmId: string,
  exitId: string,
  activeProfileId?: string | null
): Promise<InsightDto | null> {
  return fetchInsight(
    `/farms/${farmId}/insights/after-sale?exitId=${encodeURIComponent(exitId)}`,
    accessToken,
    activeProfileId
  );
}

export function fetchAfterFarrowingInsight(
  accessToken: string,
  farmId: string,
  litterId: string,
  activeProfileId?: string | null
): Promise<InsightDto | null> {
  return fetchInsight(
    `/farms/${farmId}/insights/after-farrowing?litterId=${encodeURIComponent(litterId)}`,
    accessToken,
    activeProfileId
  );
}

/** Helper testable : échoue silencieusement (timeout / 204 / erreur). */
export async function safeInsightFetch(
  fn: () => Promise<InsightDto | null>
): Promise<InsightDto | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}
