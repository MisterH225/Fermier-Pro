import { MillIngredientPackaging } from "@prisma/client";
import {
  compareMillPriceEntries,
  filterMillsByRadius,
  haversineKm,
  parseRationLines,
  priceCompositionAtMill,
  type OfferForPricing,
  type RationLineForPricing
} from "./composition-pricing.util";

const ration: RationLineForPricing[] = [
  {
    feedIngredientId: "corn",
    canonicalName: "Maïs",
    quantityKg: 70
  },
  {
    feedIngredientId: "soy",
    canonicalName: "Tourteau de soja",
    quantityKg: 30
  }
];

function offer(
  partial: Partial<OfferForPricing> &
    Pick<OfferForPricing, "feedIngredientId" | "pricePerUnit">
): OfferForPricing {
  return {
    packaging: MillIngredientPackaging.kg,
    unitToKg: 1,
    stockQuantity: 1000,
    mixingCostPerKg: null,
    canonicalName: partial.feedIngredientId,
    ...partial
  };
}

describe("composition-pricing.util — prix multi-moulins (P-J4-A)", () => {
  it("calcule le prix correct (intrants × quantités × prix/kg + mélange)", () => {
    // Maïs 200 XOF/kg × 70 = 14 000 ; soja 400 × 30 = 12 000 ; mélange 10 × 100 = 1 000
    const priced = priceCompositionAtMill(ration, [
      offer({
        feedIngredientId: "corn",
        pricePerUnit: 200,
        mixingCostPerKg: 10
      }),
      offer({
        feedIngredientId: "soy",
        pricePerUnit: 400
      })
    ]);
    expect(priced.availabilityComplete).toBe(true);
    expect(priced.ingredientsCostXof).toBe(26000);
    expect(priced.mixingCostXof).toBe(1000);
    expect(priced.totalPriceXof).toBe(27000);
    expect(priced.missingIngredients).toEqual([]);
  });

  it("convertit via unitToKg (sac 50 kg)", () => {
    // 10 000 XOF / sac 50 kg → 200 XOF/kg × 70 = 14 000
    const priced = priceCompositionAtMill(
      [{ feedIngredientId: "corn", canonicalName: "Maïs", quantityKg: 70 }],
      [
        offer({
          feedIngredientId: "corn",
          pricePerUnit: 10000,
          packaging: MillIngredientPackaging.sack_50kg,
          unitToKg: 50,
          stockQuantity: 10
        })
      ]
    );
    expect(priced.totalPriceXof).toBe(14000);
    expect(priced.availabilityComplete).toBe(true);
  });

  it("liste un moulin incomplet avec l’intrant manquant (pas d’exclusion silencieuse)", () => {
    const priced = priceCompositionAtMill(ration, [
      offer({ feedIngredientId: "corn", pricePerUnit: 200 })
      // soja absent
    ]);
    expect(priced.availabilityComplete).toBe(false);
    expect(priced.missingIngredients).toEqual([
      {
        feedIngredientId: "soy",
        canonicalName: "Tourteau de soja",
        requiredKg: 30,
        reason: "no_offer",
        availableKg: null
      }
    ]);
    // Prix partiel maïs uniquement
    expect(priced.totalPriceXof).toBe(14000);
  });

  it("signale un stock insuffisant", () => {
    const priced = priceCompositionAtMill(
      [{ feedIngredientId: "corn", canonicalName: "Maïs", quantityKg: 100 }],
      [
        offer({
          feedIngredientId: "corn",
          pricePerUnit: 200,
          stockQuantity: 40 // 40 kg dispo
        })
      ]
    );
    expect(priced.availabilityComplete).toBe(false);
    expect(priced.missingIngredients[0]).toMatchObject({
      feedIngredientId: "corn",
      reason: "insufficient_stock",
      availableKg: 40,
      requiredKg: 100
    });
  });

  it("trie complets d’abord puis par prix croissant", () => {
    const rows = [
      {
        availabilityComplete: false,
        totalPriceXof: 1000,
        distanceKm: 1
      },
      {
        availabilityComplete: true,
        totalPriceXof: 5000,
        distanceKm: 10
      },
      {
        availabilityComplete: true,
        totalPriceXof: 3000,
        distanceKm: 20
      }
    ];
    const sorted = [...rows].sort(compareMillPriceEntries);
    expect(sorted.map((r) => r.totalPriceXof)).toEqual([3000, 5000, 1000]);
  });

  it("filtre par rayon géographique (haversine)", () => {
    // ~11 km entre (5.3, -4.0) et (5.4, -4.0)
    const d = haversineKm(5.3, -4.0, 5.4, -4.0);
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(12);

    const filtered = filterMillsByRadius(
      { latitude: 5.3, longitude: -4.0, departmentCode: "CI-AB" },
      [
        {
          millId: "near",
          latitude: 5.35,
          longitude: -4.0,
          departmentCode: "CI-AB"
        },
        {
          millId: "far",
          latitude: 7.7,
          longitude: -5.0,
          departmentCode: "CI-BK"
        }
      ],
      50
    );
    const inRadius = filtered.filter((m) => m.inRadius).map((m) => m.millId);
    expect(inRadius).toEqual(["near"]);
    expect(filtered.find((m) => m.millId === "near")!.distanceKm).toBeLessThan(
      10
    );
  });

  it("dégradé sans coordonnées : filtre par département", () => {
    const filtered = filterMillsByRadius(
      { latitude: null, longitude: null, departmentCode: "CI-AB" },
      [
        {
          millId: "same",
          latitude: null,
          longitude: null,
          departmentCode: "CI-AB"
        },
        {
          millId: "other",
          latitude: null,
          longitude: null,
          departmentCode: "CI-BK"
        }
      ],
      50
    );
    expect(filtered.filter((m) => m.inRadius).map((m) => m.millId)).toEqual([
      "same"
    ]);
    expect(filtered.every((m) => m.distanceKm == null)).toBe(true);
  });

  it("parse les lignes de ration JSON", () => {
    expect(
      parseRationLines([
        { feedIngredientId: "corn", quantityKg: 10, canonicalName: "Maïs" },
        { feedIngredientId: "x", quantityKg: 0 },
        { foo: 1 }
      ])
    ).toEqual([
      { feedIngredientId: "corn", quantityKg: 10, canonicalName: "Maïs" }
    ]);
  });
});
