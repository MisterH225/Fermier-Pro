import type { ClientFeatureKey } from "../config-client/feature-flags.service";

/** Identifiants des modules plateforme (table `PlatformFeatureFlag`). */
export const PLATFORM_MODULE_IDS = [
  "core_producer",
  "technician",
  "veterinarian",
  "marketplace",
  "buyer",
  "wallet",
  "collaboration",
  "reports",
  "ai_assistant",
  "pig_price_index",
  "gestation",
  "nutrition",
  "merchant",
  "mills",
  "feed_composition",
  "delivery"
] as const;

export type PlatformModuleId = (typeof PLATFORM_MODULE_IDS)[number];

export const CORE_PRODUCER_MODULE: PlatformModuleId = "core_producer";

/**
 * Modules créés inactifs par défaut (features à venir).
 * Les modules historiques restent actifs sauf désactivation admin.
 */
export const MODULES_DEFAULT_OFF: readonly PlatformModuleId[] = [
  "mills",
  "feed_composition",
  "delivery"
] as const;

/** Libellés / descriptions admin (FR). */
export const PLATFORM_MODULE_META: Partial<
  Record<
    PlatformModuleId,
    { moduleName: string; description: string; icon: string | null }
  >
> = {
  mills: {
    moduleName: "Moulins",
    description:
      "Réseau de moulins et commandes d'aliments transformés.",
    icon: null
  },
  feed_composition: {
    moduleName: "Composition d'aliments",
    description:
      "Formules et compositions commandables auprès des moulins.",
    icon: null
  },
  delivery: {
    moduleName: "Livraison",
    description:
      "Livraison des commandes marketplace et produits associés.",
    icon: null
  }
};

/** Désactivation en cascade : clé = module désactivé, valeurs = modules à désactiver aussi. */
export const MODULE_DISABLE_CASCADE: Partial<
  Record<PlatformModuleId, PlatformModuleId[]>
> = {
  marketplace: ["buyer", "mills", "feed_composition", "delivery"],
  mills: ["feed_composition"]
};

/**
 * Prérequis à l'activation : le module clé nécessite que les valeurs soient actives.
 * Appliqués aussi à la résolution runtime (global OU allow-list de test).
 * L'allow-list contourne l'activation globale mais PAS les prérequis.
 */
export const MODULE_ENABLE_PREREQUISITES: Partial<
  Record<PlatformModuleId, PlatformModuleId[]>
> = {
  buyer: ["marketplace"],
  mills: ["marketplace"],
  feed_composition: ["mills"],
  delivery: ["marketplace"]
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
  feedStock: "nutrition",
  wallet: "wallet"
};

export function isPlatformModuleId(value: string): value is PlatformModuleId {
  return (PLATFORM_MODULE_IDS as readonly string[]).includes(value);
}

export function isModuleDefaultOff(moduleId: PlatformModuleId): boolean {
  return (MODULES_DEFAULT_OFF as readonly string[]).includes(moduleId);
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
