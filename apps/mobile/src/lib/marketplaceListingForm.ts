import type {
  AnimalListItem,
  CreateMarketplaceListingPayload,
  MarketplaceListingListItem,
  UpdateMarketplaceListingPayload
} from "./api";
import { listingPhotoUrlsArray } from "./resolveListingImage";

export type ListingCategory = "piglet" | "breeder" | "butcher" | "reformed";

/** Poids moyen max. (kg) pour rester en catégorie porcelet (aligné API). */
export const LISTING_PIGLET_MAX_AVG_KG = 15;

/** Porcelets et reproducteurs : prix forfaitaire (pas au kg). */
export function usesFlatListingPrice(category: ListingCategory): boolean {
  return category === "piglet" || category === "breeder";
}

export type ListingDurationDays = 7 | 14 | 30;

export type MarketplaceListingFormValues = {
  farmId: string | null;
  /** Animal principal (compat API). */
  animalId: string | null;
  /** Animaux liés au lot (cheptel). */
  selectedAnimalIds: string[];
  category: ListingCategory;
  title: string;
  description: string;
  totalWeightKg: string;
  pricePerKg: string;
  totalPrice: string;
  /** true si l'utilisateur a modifié le prix total à la main. */
  totalPriceManual: boolean;
  currency: string;
  locationLabel: string;
  breedLabel: string;
  /** Durée appliquée à la publication (écran détail). */
  publishDurationDays: ListingDurationDays;
  /** URLs Supabase (ordre = affichage ; [0] = principale). */
  photoUrls: string[];
};

export const EMPTY_MARKETPLACE_LISTING_FORM: MarketplaceListingFormValues = {
  farmId: null,
  animalId: null,
  selectedAnimalIds: [],
  category: "piglet",
  title: "",
  description: "",
  totalWeightKg: "",
  pricePerKg: "",
  totalPrice: "",
  totalPriceManual: false,
  currency: "XOF",
  locationLabel: "",
  breedLabel: "",
  publishDurationDays: 14,
  photoUrls: []
};

/**
 * Recatégorise selon le poids si l’utilisateur est en mode « porcelet » (auto).
 * Reproducteur / charcutier / réformée = intention vendeur conservée.
 */
export function suggestListingCategoryFromWeight(
  totalWeightKg: number,
  headcount: number,
  current: ListingCategory
): ListingCategory {
  if (
    current === "breeder" ||
    current === "reformed" ||
    current === "butcher"
  ) {
    return current;
  }
  const avg = totalWeightKg / Math.max(1, headcount);
  if (avg < LISTING_PIGLET_MAX_AVG_KG) {
    return "piglet";
  }
  return "butcher";
}

export function parseDecimalField(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function computeTotalFromWeightAndPrice(
  weightKg: string,
  pricePerKg: string
): number | null {
  const w = parseDecimalField(weightKg);
  const p = parseDecimalField(pricePerKg);
  if (w == null || p == null || w <= 0) return null;
  return w * p;
}

export function formatDecimalForInput(n: number, maxFrac = 2): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: maxFrac,
    useGrouping: false
  });
}

/** Dernière pesée connue d'un animal (kg). */
export function latestAnimalWeightKg(animal: AnimalListItem): number | null {
  if (!animal.weights?.length) return null;
  const sorted = [...animal.weights].sort(
    (a, b) =>
      new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
  );
  const w = sorted[0]?.weightKg;
  if (w === undefined || w === null) return null;
  const n = typeof w === "string" ? Number.parseFloat(w) : Number(w);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Somme des dernières pesées des animaux sélectionnés. */
export function sumSelectedAnimalsWeightKg(
  animals: AnimalListItem[],
  selectedIds: string[]
): number | null {
  if (selectedIds.length === 0) return null;
  let sum = 0;
  let any = false;
  for (const id of selectedIds) {
    const a = animals.find((x) => x.id === id);
    if (!a) continue;
    const w = latestAnimalWeightKg(a);
    if (w != null) {
      sum += w;
      any = true;
    }
  }
  return any ? sum : null;
}

export function buildMarketplaceListingPayload(
  values: MarketplaceListingFormValues,
  t: (key: string) => string
): CreateMarketplaceListingPayload {
  const title = values.title.trim();
  if (!title) {
    throw new Error(t("marketScreen.createForm.errors.titleRequired"));
  }

  const flatPrice = usesFlatListingPrice(values.category);
  const totalWeightKg = parseDecimalField(values.totalWeightKg);
  const pricePerKg = parseDecimalField(values.pricePerKg);
  let totalPrice = parseDecimalField(values.totalPrice);
  if (
    !flatPrice &&
    totalPrice == null &&
    totalWeightKg != null &&
    pricePerKg != null
  ) {
    totalPrice = totalWeightKg * pricePerKg;
  }

  if (!flatPrice && (totalWeightKg == null || totalWeightKg <= 0)) {
    throw new Error(t("marketScreen.createForm.errors.weightRequired"));
  }
  if (!flatPrice && (pricePerKg == null || pricePerKg <= 0)) {
    throw new Error(t("marketScreen.createForm.errors.pricePerKgRequired"));
  }
  if (totalPrice == null || totalPrice <= 0) {
    throw new Error(
      flatPrice
        ? t("marketScreen.createForm.errors.flatPriceRequired")
        : t("marketScreen.createForm.errors.totalRequired")
    );
  }

  const animalIds =
    values.selectedAnimalIds.length > 0
      ? values.selectedAnimalIds
      : values.animalId
        ? [values.animalId]
        : [];

  const payload: CreateMarketplaceListingPayload = {
    title,
    description: values.description.trim() || undefined,
    currency: values.currency.trim() || "XOF",
    locationLabel: values.locationLabel.trim() || undefined,
    category: values.category,
    totalWeightKg: totalWeightKg ?? undefined,
    pricePerKg: flatPrice ? undefined : pricePerKg ?? undefined,
    totalPrice,
    breedLabel: values.breedLabel.trim() || undefined,
    animalIds: animalIds.length > 0 ? animalIds : undefined
  };

  if (values.photoUrls.length > 0) {
    payload.photoUrls = values.photoUrls;
  }

  if (values.farmId) {
    payload.farmId = values.farmId;
  }
  if (values.animalId) {
    payload.animalId = values.animalId;
  } else if (animalIds.length === 1) {
    payload.animalId = animalIds[0];
  }

  return payload;
}

export function applyAnimalSelection(
  prev: MarketplaceListingFormValues,
  animal: AnimalListItem,
  animals: AnimalListItem[],
  multi: boolean
): Partial<MarketplaceListingFormValues> {
  const ids = multi
    ? prev.selectedAnimalIds.includes(animal.id)
      ? prev.selectedAnimalIds.filter((id) => id !== animal.id)
      : [...prev.selectedAnimalIds, animal.id]
    : [animal.id];

  const primaryId = ids.length === 1 ? ids[0]! : ids[0] ?? null;
  const weightSum = sumSelectedAnimalsWeightKg(animals, ids);

  const patch: Partial<MarketplaceListingFormValues> = {
    selectedAnimalIds: ids,
    animalId: ids.length === 1 ? ids[0]! : primaryId,
    breedLabel:
      ids.length === 1
        ? (animals.find((a) => a.id === ids[0])?.breed?.name ?? prev.breedLabel)
        : prev.breedLabel
  };

  if (weightSum != null) {
    patch.totalWeightKg = formatDecimalForInput(weightSum, 1);
    patch.category = suggestListingCategoryFromWeight(
      weightSum,
      ids.length || 1,
      prev.category
    );
    patch.totalPriceManual = false;
    const computed = computeTotalFromWeightAndPrice(
      patch.totalWeightKg,
      prev.pricePerKg
    );
    if (computed != null) {
      patch.totalPrice = formatDecimalForInput(computed, 0);
    }
  } else if (ids.length === 0) {
    patch.animalId = null;
  }

  return patch;
}


const LISTING_CATEGORIES: ListingCategory[] = [
  "piglet",
  "breeder",
  "butcher",
  "reformed"
];

export function parseListingNumberField(
  v: string | number | null | undefined,
  maxFrac = 2
): string {
  if (v == null || v === "") {
    return "";
  }
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  if (!Number.isFinite(n)) {
    return "";
  }
  return formatDecimalForInput(n, maxFrac);
}

export function listingToFormValues(
  listing: MarketplaceListingListItem
): MarketplaceListingFormValues {
  const rawCategory = listing.category ?? "piglet";
  const category = LISTING_CATEGORIES.includes(rawCategory as ListingCategory)
    ? (rawCategory as ListingCategory)
    : "piglet";
  const animalIds =
    listing.animalIds && listing.animalIds.length > 0
      ? listing.animalIds
      : listing.animal
        ? [listing.animal.id]
        : [];
  const flatPrice = usesFlatListingPrice(category);
  const totalPriceRaw =
    listing.totalPrice != null
      ? listing.totalPrice
      : listing.unitPrice != null
        ? listing.unitPrice
        : null;

  return {
    farmId: listing.farm?.id ?? null,
    animalId: animalIds.length === 1 ? animalIds[0]! : (animalIds[0] ?? null),
    selectedAnimalIds: [...animalIds],
    category,
    title: listing.title,
    description: listing.description ?? "",
    totalWeightKg: parseListingNumberField(listing.totalWeightKg, 1),
    pricePerKg: flatPrice ? "" : parseListingNumberField(listing.pricePerKg),
    totalPrice: parseListingNumberField(totalPriceRaw, 0),
    totalPriceManual: flatPrice || totalPriceRaw != null,
    currency: listing.currency?.trim() || "XOF",
    locationLabel: listing.locationLabel ?? "",
    breedLabel: listing.breedLabel ?? "",
    publishDurationDays: 14,
    photoUrls: listingPhotoUrlsArray(listing.photoUrls)
  };
}

export function buildUpdateMarketplaceListingPayload(
  values: MarketplaceListingFormValues,
  t: (key: string) => string
): UpdateMarketplaceListingPayload {
  const createPayload = buildMarketplaceListingPayload(values, t);
  return {
    title: createPayload.title,
    description: createPayload.description ?? null,
    currency: createPayload.currency,
    locationLabel: createPayload.locationLabel ?? null,
    category: createPayload.category,
    photoUrls: createPayload.photoUrls,
    animalIds: createPayload.animalIds,
    totalWeightKg: createPayload.totalWeightKg ?? null,
    pricePerKg: createPayload.pricePerKg ?? null,
    totalPrice: createPayload.totalPrice,
    breedLabel: createPayload.breedLabel ?? null
  };
}

/** Retire les animaux vendus ou absents du cheptel de la sélection. */
export function filterSelectableAnimalIds(
  selectedIds: string[],
  animals: AnimalListItem[]
): string[] {
  const activeIds = new Set(
    animals.filter((a) => a.status === "active").map((a) => a.id)
  );
  return selectedIds.filter((id) => activeIds.has(id));
}
