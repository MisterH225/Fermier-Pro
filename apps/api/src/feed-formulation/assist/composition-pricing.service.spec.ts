import {
  BadRequestException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { MerchantKind, MillIngredientPackaging } from "@prisma/client";
import { CompositionPricingService } from "./composition-pricing.service";
import type { FarmAccessService } from "../../common/farm-access.service";
import type { PrismaService } from "../../prisma/prisma.service";

describe("CompositionPricingService", () => {
  const producer = { id: "prod-1" } as never;
  const vet = { id: "vet-1" } as never;

  const validated = {
    id: "comp-1",
    farmId: "farm-1",
    createdByUserId: "prod-1",
    status: "validated",
    ration: [
      {
        feedIngredientId: "corn",
        canonicalName: "Maïs",
        quantityKg: 50,
        proportionPct: 50,
        costContribution: 10000
      },
      {
        feedIngredientId: "soy",
        canonicalName: "Soja",
        quantityKg: 50,
        proportionPct: 50,
        costContribution: 20000
      }
    ]
  };

  function build(opts?: {
    scopesOk?: boolean;
    composition?: typeof validated | null;
    mills?: unknown[];
    farm?: {
      id: string;
      latitude: number | null;
      longitude: number | null;
      departmentCode: string | null;
    };
  }) {
    const scopesOk = opts?.scopesOk !== false;
    const prisma = {
      savedComposition: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            opts?.composition === undefined ? validated : opts.composition
          )
      },
      farm: {
        findUnique: jest.fn().mockResolvedValue(
          opts?.farm ?? {
            id: "farm-1",
            latitude: 5.3,
            longitude: -4.0,
            departmentCode: "CI-AB"
          }
        )
      },
      merchantProfile: {
        findMany: jest.fn().mockResolvedValue(opts?.mills ?? [])
      },
      localityRef: {
        findMany: jest.fn().mockResolvedValue([])
      }
    };

    const farmAccess: jest.Mocked<
      Pick<FarmAccessService, "requireFarmScopes">
    > = {
      requireFarmScopes: jest.fn().mockImplementation(async () => {
        if (!scopesOk) {
          throw new ForbiddenException("Permission manquante: finance.write");
        }
      })
    };

    const service = new CompositionPricingService(
      prisma as unknown as PrismaService,
      farmAccess as unknown as FarmAccessService
    );
    return { service, prisma, farmAccess };
  }

  it("producteur autorisé obtient les prix triés (complets d’abord)", async () => {
    const mills = [
      {
        id: "mill-expensive-complete",
        user: {
          fullName: "Moulin Cher",
          homeLatitude: 5.31,
          homeLongitude: -4.01
        },
        shops: [{ name: "Moulin Cher", locationLabel: "Abidjan" }],
        millIngredientOffers: [
          {
            feedIngredientId: "corn",
            pricePerUnit: 300,
            packaging: MillIngredientPackaging.kg,
            unitToKg: 1,
            stockQuantity: 200,
            mixingCostPerKg: 0,
            feedIngredient: { canonicalName: "Maïs", isActive: true }
          },
          {
            feedIngredientId: "soy",
            pricePerUnit: 500,
            packaging: MillIngredientPackaging.kg,
            unitToKg: 1,
            stockQuantity: 200,
            mixingCostPerKg: null,
            feedIngredient: { canonicalName: "Soja", isActive: true }
          }
        ]
      },
      {
        id: "mill-cheap-complete",
        user: {
          fullName: "Moulin Bon",
          homeLatitude: 5.32,
          homeLongitude: -4.02
        },
        shops: [{ name: "Moulin Bon", locationLabel: "Abidjan" }],
        millIngredientOffers: [
          {
            feedIngredientId: "corn",
            pricePerUnit: 200,
            packaging: MillIngredientPackaging.kg,
            unitToKg: 1,
            stockQuantity: 200,
            mixingCostPerKg: 5,
            feedIngredient: { canonicalName: "Maïs", isActive: true }
          },
          {
            feedIngredientId: "soy",
            pricePerUnit: 400,
            packaging: MillIngredientPackaging.kg,
            unitToKg: 1,
            stockQuantity: 200,
            mixingCostPerKg: null,
            feedIngredient: { canonicalName: "Soja", isActive: true }
          }
        ]
      },
      {
        id: "mill-incomplete",
        user: {
          fullName: "Moulin Partiel",
          homeLatitude: 5.33,
          homeLongitude: -4.0
        },
        shops: [{ name: "Moulin Partiel", locationLabel: "Abidjan" }],
        millIngredientOffers: [
          {
            feedIngredientId: "corn",
            pricePerUnit: 100,
            packaging: MillIngredientPackaging.kg,
            unitToKg: 1,
            stockQuantity: 200,
            mixingCostPerKg: null,
            feedIngredient: { canonicalName: "Maïs", isActive: true }
          }
        ]
      },
      {
        id: "mill-far",
        user: {
          fullName: "Moulin Loin",
          homeLatitude: 9.5,
          homeLongitude: -5.5
        },
        shops: [{ name: "Moulin Loin", locationLabel: "Korhogo" }],
        millIngredientOffers: [
          {
            feedIngredientId: "corn",
            pricePerUnit: 50,
            packaging: MillIngredientPackaging.kg,
            unitToKg: 1,
            stockQuantity: 999,
            mixingCostPerKg: null,
            feedIngredient: { canonicalName: "Maïs", isActive: true }
          },
          {
            feedIngredientId: "soy",
            pricePerUnit: 50,
            packaging: MillIngredientPackaging.kg,
            unitToKg: 1,
            stockQuantity: 999,
            mixingCostPerKg: null,
            feedIngredient: { canonicalName: "Soja", isActive: true }
          }
        ]
      }
    ];

    const { service, farmAccess } = build({ mills });
    const res = await service.priceForMills(producer, "comp-1", 50);

    expect(farmAccess.requireFarmScopes).toHaveBeenCalledWith(
      "prod-1",
      "farm-1",
      ["finance.write"]
    );
    expect(res.radiusKm).toBe(50);
    // Loin exclu par rayon ; incomplets après complets ; bon marché avant cher
    expect(res.mills.map((m) => m.millId)).toEqual([
      "mill-cheap-complete",
      "mill-expensive-complete",
      "mill-incomplete"
    ]);
    // 200*50 + 400*50 + 5*100 = 10k+20k+500 = 30500
    expect(res.mills[0].totalPriceXof).toBe(30500);
    expect(res.mills[0].mixingCost).toBe(500);
    expect(res.mills[0].availabilityComplete).toBe(true);
    expect(res.mills[2].availabilityComplete).toBe(false);
    expect(res.mills[2].missingIngredients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feedIngredientId: "soy",
          reason: "no_offer"
        })
      ])
    );
  });

  it("véto / sans finance.write → 403", async () => {
    const { service } = build({ scopesOk: false });
    await expect(service.priceForMills(vet, "comp-1")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("composition introuvable → 404", async () => {
    const { service } = build({ composition: null });
    await expect(
      service.priceForMills(producer, "missing")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("composition non validée → 400", async () => {
    const { service } = build({
      composition: { ...validated, status: "draft" }
    });
    await expect(
      service.priceForMills(producer, "comp-1")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("dégradé sans coordonnées ferme : filtre par département", async () => {
    const mills = [
      {
        id: "mill-abidjan",
        user: {
          fullName: "Moulin AB",
          homeLatitude: null,
          homeLongitude: null
        },
        shops: [{ name: "Moulin AB", locationLabel: "Abidjan" }],
        millIngredientOffers: [
          {
            feedIngredientId: "corn",
            pricePerUnit: 200,
            packaging: MillIngredientPackaging.kg,
            unitToKg: 1,
            stockQuantity: 200,
            mixingCostPerKg: null,
            feedIngredient: { canonicalName: "Maïs", isActive: true }
          },
          {
            feedIngredientId: "soy",
            pricePerUnit: 400,
            packaging: MillIngredientPackaging.kg,
            unitToKg: 1,
            stockQuantity: 200,
            mixingCostPerKg: null,
            feedIngredient: { canonicalName: "Soja", isActive: true }
          }
        ]
      },
      {
        id: "mill-bouake",
        user: {
          fullName: "Moulin BK",
          homeLatitude: null,
          homeLongitude: null
        },
        shops: [{ name: "Moulin BK", locationLabel: "Bouaké" }],
        millIngredientOffers: [
          {
            feedIngredientId: "corn",
            pricePerUnit: 100,
            packaging: MillIngredientPackaging.kg,
            unitToKg: 1,
            stockQuantity: 200,
            mixingCostPerKg: null,
            feedIngredient: { canonicalName: "Maïs", isActive: true }
          },
          {
            feedIngredientId: "soy",
            pricePerUnit: 100,
            packaging: MillIngredientPackaging.kg,
            unitToKg: 1,
            stockQuantity: 200,
            mixingCostPerKg: null,
            feedIngredient: { canonicalName: "Soja", isActive: true }
          }
        ]
      }
    ];

    const { service, prisma } = build({
      mills,
      farm: {
        id: "farm-1",
        latitude: null,
        longitude: null,
        departmentCode: "CI-AB"
      }
    });
    prisma.localityRef.findMany.mockResolvedValue([
      { nameNormalized: "abidjan", departmentCode: "CI-AB" },
      { nameNormalized: "bouake", departmentCode: "CI-BK" }
    ]);

    const res = await service.priceForMills(producer, "comp-1", 50);
    expect(res.mills.map((m) => m.millId)).toEqual(["mill-abidjan"]);
    expect(res.mills[0].distanceKm).toBeNull();
  });

  it("n’utilise que MillIngredientOffer (merchantKind=mill)", async () => {
    const { service, prisma } = build({ mills: [] });
    await service.priceForMills(producer, "comp-1");
    expect(prisma.merchantProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          merchantKind: MerchantKind.mill,
          isActive: true
        })
      })
    );
  });
});
