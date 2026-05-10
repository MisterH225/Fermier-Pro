import type { ClientConfigDto } from "./api";

const SCOPE_ALL = "*";

/** Vérifie un ou plusieurs scopes (OU). `*` (ALL) accorde tout. */
export function hasFarmScope(
  scopes: string[] | undefined,
  required: string | string[]
): boolean {
  if (!scopes?.length) {
    return false;
  }
  if (scopes.includes(SCOPE_ALL)) {
    return true;
  }
  const reqs = Array.isArray(required) ? required : [required];
  return reqs.some((r) => scopes.includes(r));
}

/**
 * Source unique pour masquer les entrées métier selon `GET /config/client`.
 * Aligné sur `FarmListScreen` (pas de ferme active : pas de scopes).
 */
export function farmDetailMenuVisibility(
  features: ClientConfigDto["features"]
) {
  return {
    chat: features.chat,
    tasks: features.tasks,
    marketplace: features.marketplace,
    vetConsultations: features.vetConsultations,
    finance: features.finance,
    housing: features.housing,
    feedStock: features.feedStock
  };
}

export type FarmDetailMenuKeys = ReturnType<typeof farmDetailMenuVisibility> & {
  /** Cheptel : scopes livestock (read/write), distinct des modules optionnels. */
  livestock: boolean;
};

/**
 * Combine feature flags (`/config/client`) et scopes RBAC (`GET /farms/:id` → `effectiveScopes`).
 * Si `scopes` est absent (API ancienne), seuls les flags s’appliquent et le cheptel reste visible.
 */
export function buildFarmDetailMenu(
  features: ClientConfigDto["features"],
  scopes: string[] | undefined
): FarmDetailMenuKeys {
  const flags = farmDetailMenuVisibility(features);
  if (scopes === undefined) {
    return {
      ...flags,
      livestock: true,
      feedStock: flags.feedStock
    };
  }
  return {
    chat: flags.chat && hasFarmScope(scopes, "chat"),
    tasks: flags.tasks && hasFarmScope(scopes, ["tasks.read", "tasks.write"]),
    marketplace:
      flags.marketplace && hasFarmScope(scopes, "marketplace.read"),
    vetConsultations:
      flags.vetConsultations && hasFarmScope(scopes, "vet.read"),
    finance: flags.finance && hasFarmScope(scopes, "finance.read"),
    housing: flags.housing && hasFarmScope(scopes, "housing.read"),
    feedStock:
      flags.feedStock && hasFarmScope(scopes, "livestock.read"),
    livestock: hasFarmScope(scopes, ["livestock.read", "livestock.write"])
  };
}
