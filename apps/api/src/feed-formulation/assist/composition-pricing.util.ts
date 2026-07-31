/**
 * Helpers purs — comparaison de prix multi-moulins (P-J4-A).
 * Source unique de prix : MillIngredientOffer (pricePerUnit / unitToKg).
 */
import {
  pricePerKg,
  resolveUnitToKg
} from "../../merchant-shop/mill-ingredient-packaging.util";
import type { MillIngredientPackaging } from "@prisma/client";

export const DEFAULT_MILL_PRICE_RADIUS_KM = 50;

export type RationLineForPricing = {
  feedIngredientId: string;
  canonicalName?: string | null;
  quantityKg: number;
};

export type OfferForPricing = {
  feedIngredientId: string;
  canonicalName?: string | null;
  pricePerUnit: number;
  packaging: MillIngredientPackaging;
  unitToKg: number;
  /** Stock en unités de conditionnement. */
  stockQuantity: number;
  mixingCostPerKg: number | null;
};

export type MissingIngredient = {
  feedIngredientId: string;
  canonicalName: string | null;
  requiredKg: number;
  reason: "no_offer" | "insufficient_stock";
  availableKg: number | null;
};

export type MillPriceBreakdown = {
  ingredientsCostXof: number;
  mixingCostXof: number;
  totalPriceXof: number;
  missingIngredients: MissingIngredient[];
  availabilityComplete: boolean;
  /** Coût de mélange au kg retenu pour ce moulin (null si non renseigné). */
  mixingCostPerKg: number | null;
};

export type MillPriceSortEntry = {
  availabilityComplete: boolean;
  totalPriceXof: number;
  distanceKm: number | null;
};

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Parse les lignes de ration JSON d'une SavedComposition. */
export function parseRationLines(ration: unknown): RationLineForPricing[] {
  if (!Array.isArray(ration)) return [];
  const lines: RationLineForPricing[] = [];
  for (const raw of ration) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const feedIngredientId =
      typeof row.feedIngredientId === "string" ? row.feedIngredientId : "";
    const quantityKg = Number(row.quantityKg);
    if (!feedIngredientId || !(quantityKg > 0)) continue;
    lines.push({
      feedIngredientId,
      canonicalName:
        typeof row.canonicalName === "string" ? row.canonicalName : null,
      quantityKg
    });
  }
  return lines;
}

/**
 * Prix de LA composition chez un moulin (offres MillIngredientOffer uniquement).
 * Intrants manquants / stock insuffisant → listés, pas exclus silencieusement.
 */
export function priceCompositionAtMill(
  ration: RationLineForPricing[],
  offers: OfferForPricing[]
): MillPriceBreakdown {
  const totalKg = ration.reduce((s, l) => s + l.quantityKg, 0);
  let ingredientsCostXof = 0;
  const missingIngredients: MissingIngredient[] = [];

  let mixingCostPerKg: number | null = null;
  for (const o of offers) {
    if (o.mixingCostPerKg != null && Number.isFinite(o.mixingCostPerKg)) {
      mixingCostPerKg = o.mixingCostPerKg;
      break;
    }
  }

  for (const line of ration) {
    const candidates = offers.filter(
      (o) => o.feedIngredientId === line.feedIngredientId
    );
    if (candidates.length === 0) {
      missingIngredients.push({
        feedIngredientId: line.feedIngredientId,
        canonicalName: line.canonicalName ?? null,
        requiredKg: line.quantityKg,
        reason: "no_offer",
        availableKg: null
      });
      continue;
    }

    type Priced = {
      pricePerKg: number;
      availableKg: number;
      mixing: number | null;
      canonicalName: string | null;
    };
    const priced: Priced[] = [];
    for (const o of candidates) {
      const unitToKg = resolveUnitToKg(o.packaging, o.unitToKg);
      const ppk = pricePerKg(o.pricePerUnit, unitToKg);
      if (ppk == null) continue;
      const availableKg = Number(o.stockQuantity) * unitToKg;
      priced.push({
        pricePerKg: ppk,
        availableKg: Number.isFinite(availableKg) ? availableKg : 0,
        mixing: o.mixingCostPerKg,
        canonicalName: o.canonicalName ?? line.canonicalName ?? null
      });
    }

    if (priced.length === 0) {
      missingIngredients.push({
        feedIngredientId: line.feedIngredientId,
        canonicalName: line.canonicalName ?? null,
        requiredKg: line.quantityKg,
        reason: "no_offer",
        availableKg: null
      });
      continue;
    }

    const withStock = priced
      .filter((p) => p.availableKg + 1e-9 >= line.quantityKg)
      .sort((a, b) => a.pricePerKg - b.pricePerKg);

    if (withStock.length === 0) {
      const bestAvail = Math.max(...priced.map((p) => p.availableKg));
      missingIngredients.push({
        feedIngredientId: line.feedIngredientId,
        canonicalName: priced[0].canonicalName,
        requiredKg: line.quantityKg,
        reason: "insufficient_stock",
        availableKg: bestAvail
      });
      continue;
    }

    const chosen = withStock[0];
    ingredientsCostXof += line.quantityKg * chosen.pricePerKg;
    if (
      mixingCostPerKg == null &&
      chosen.mixing != null &&
      Number.isFinite(chosen.mixing)
    ) {
      mixingCostPerKg = chosen.mixing;
    }
  }

  const mixingCostXof =
    mixingCostPerKg != null && totalKg > 0
      ? mixingCostPerKg * totalKg
      : 0;

  return {
    ingredientsCostXof: roundMoney(ingredientsCostXof),
    mixingCostXof: roundMoney(mixingCostXof),
    totalPriceXof: roundMoney(ingredientsCostXof + mixingCostXof),
    missingIngredients,
    availabilityComplete: missingIngredients.length === 0,
    mixingCostPerKg
  };
}

/** Complets d'abord, puis prix croissant, puis distance. */
export function compareMillPriceEntries(
  a: MillPriceSortEntry,
  b: MillPriceSortEntry
): number {
  if (a.availabilityComplete !== b.availabilityComplete) {
    return a.availabilityComplete ? -1 : 1;
  }
  if (a.totalPriceXof !== b.totalPriceXof) {
    return a.totalPriceXof - b.totalPriceXof;
  }
  const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
  const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
  return da - db;
}

export type MillGeoCandidate = {
  millId: string;
  latitude: number | null;
  longitude: number | null;
  departmentCode: string | null;
};

export type FarmGeoContext = {
  latitude: number | null;
  longitude: number | null;
  departmentCode: string | null;
};

/**
 * Filtre les moulins dans le rayon.
 * - Coordonnées des deux côtés → haversine ≤ radiusKm
 * - Sinon dégradé : même departmentCode (si ferme a un département)
 * - Sans aucune géo ferme → tous les moulins (distance inconnue)
 */
export function filterMillsByRadius(
  farm: FarmGeoContext,
  mills: MillGeoCandidate[],
  radiusKm: number
): Array<MillGeoCandidate & { distanceKm: number | null; inRadius: boolean }> {
  const farmHasCoords =
    farm.latitude != null &&
    farm.longitude != null &&
    Number.isFinite(farm.latitude) &&
    Number.isFinite(farm.longitude);
  const radius = radiusKm > 0 ? radiusKm : DEFAULT_MILL_PRICE_RADIUS_KM;

  return mills.map((m) => {
    const millHasCoords =
      m.latitude != null &&
      m.longitude != null &&
      Number.isFinite(m.latitude) &&
      Number.isFinite(m.longitude);

    if (farmHasCoords && millHasCoords) {
      const distanceKm = haversineKm(
        farm.latitude!,
        farm.longitude!,
        m.latitude!,
        m.longitude!
      );
      return {
        ...m,
        distanceKm,
        inRadius: distanceKm <= radius + 1e-9
      };
    }

    if (farm.departmentCode) {
      const sameDept =
        m.departmentCode != null && m.departmentCode === farm.departmentCode;
      return {
        ...m,
        distanceKm: null,
        inRadius: sameDept
      };
    }

    // Aucune géo ferme : on liste tous les moulins (dégradé maximal).
    return { ...m, distanceKm: null, inRadius: true };
  });
}

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
