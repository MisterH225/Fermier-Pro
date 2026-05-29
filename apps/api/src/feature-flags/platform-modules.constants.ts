import type { ClientFeatureKey } from "../config-client/feature-flags.service";

/** Identifiants des 11 modules plateforme (table `PlatformFeatureFlag`). */
export const PLATFORM_MODULE_IDS = [
  "core_producer",
  "technician",
  "veterinarian",
  "marketplace",
  "buyer",
  "collaboration",
  "reports",
  "ai_assistant",
  "pig_price_index",
  "gestation",
  "nutrition"
] as const;

export type PlatformModuleId = (typeof PLATFORM_MODULE_IDS)[number];

export const CORE_PRODUCER_MODULE: PlatformModuleId = "core_producer";

/** Désactivation en cascade : clé = module désactivé, valeurs = modules à désactiver aussi. */
export const MODULE_DISABLE_CASCADE: Partial<
  Record<PlatformModuleId, PlatformModuleId[]>
> = {
  marketplace: ["buyer"]
};

/** Prérequis à l'activation : le module clé nécessite que les valeurs soient actives. */
export const MODULE_ENABLE_PREREQUISITES: Partial<
  Record<PlatformModuleId, PlatformModuleId[]>
> = {
  buyer: ["marketplace"]
};

/** Lien entre les clés client historiques (env) et les modules plateforme. */
export const CLIENT_FEATURE_TO_PLATFORM: Record<
  ClientFeatureKey,
  PlatformModuleId
> = {
  marketplace: "marketplace",
  chat: "collaboration",
  vetConsultations: "veterinarian",
  tasks: "technician",
  finance: "core_producer",
  housing: "core_producer",
  feedStock: "nutrition"
};

export function isPlatformModuleId(value: string): value is PlatformModuleId {
  return (PLATFORM_MODULE_IDS as readonly string[]).includes(value);
}

/** Modules à désactiver en cascade lors d'une désactivation manuelle. */
export function collectCascadeTargets(
  moduleId: PlatformModuleId
): PlatformModuleId[] {
  const seen = new Set<PlatformModuleId>();
  const queue: PlatformModuleId[] = [...(MODULE_DISABLE_CASCADE[moduleId] ?? [])];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const dep of MODULE_DISABLE_CASCADE[current] ?? []) {
      if (!seen.has(dep)) queue.push(dep);
    }
  }
  return [...seen];
}
