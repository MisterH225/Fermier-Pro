import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { MerchantKind, MillIngredientPackaging } from "@prisma/client";
import { MillIngredientOffersService } from "./mill-ingredient-offers.service";

describe("MillIngredientOffersService", () => {
  const user = { id: "user-mill" } as never;

  function build(opts: {
    millsActive?: boolean;
    merchantKind?: MerchantKind;
    ingredientId?: string;
  }) {
    const millProfile = {
      id: "mp-mill",
      userId: "user-mill",
      merchantKind: opts.merchantKind ?? MerchantKind.mill,
      subscriptionTier: "free"
    };
    const offers = new Map<string, Record<string, unknown>>();
    let productSeq = 0;

    const prisma = {
      merchantProfile: {
        findUnique: jest.fn().mockResolvedValue(millProfile),
        update: jest.fn().mockResolvedValue(millProfile)
      },
      millIngredientOffer: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const row = {
            id: "offer-1",
            isActive: true,
            isPubliclyListed: false,
            merchantProductId: null,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          offers.set(row.id, row);
          return row;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          const row = offers.get(where.id);
          if (!row) return null;
          return {
            ...row,
            feedIngredient: {
              canonicalName: "Maïs",
              category: "cereal",
              imageUrl: null,
              iconKey: "cereal"
            },
            millProfile: {
              userId: millProfile.userId,
              subscriptionTier: millProfile.subscriptionTier
            }
          };
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          const row = offers.get(where.id);
          if (!row || row.millProfileId !== where.millProfileId) return null;
          return {
            ...row,
            feedIngredient: {
              id: row.feedIngredientId,
              canonicalName: "Maïs",
              aliases: ["mais", "corn"],
              category: "cereal",
              imageUrl: null,
              iconKey: "cereal"
            },
            merchantProduct: row.merchantProductId
              ? { id: row.merchantProductId, status: "published", stock: 10 }
              : null
          };
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const prev = offers.get(where.id) ?? {};
          const next = { ...prev, ...data };
          offers.set(where.id, next);
          return next;
        })
      },
      merchantShop: {
        findFirst: jest.fn().mockResolvedValue({ id: "shop-1" }),
        create: jest.fn()
      },
      merchantProduct: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          productSeq += 1;
          return { id: `prod-${productSeq}`, ...data, publishedAt: null };
        }),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockImplementation(async ({ where }) => ({
          id: where.id,
          status: "draft",
          publishedAt: null
        }))
      }
    };

    const profiles = {
      ensureProfile: jest.fn().mockResolvedValue(millProfile)
    };
    const categories = {
      listPublic: jest.fn().mockResolvedValue([
        { id: "cat-alim", name: "Alimentation", slug: "alimentation" }
      ])
    };
    const feedIngredients = {
      getById: jest.fn().mockResolvedValue({
        id: opts.ingredientId ?? "ing-1",
        canonicalName: "Maïs"
      }),
      list: jest.fn().mockResolvedValue([])
    };
    const platformFlags = {
      isModuleActiveForUser: jest
        .fn()
        .mockResolvedValue(opts.millsActive ?? true)
    };

    const service = new MillIngredientOffersService(
      prisma as never,
      profiles as never,
      categories as never,
      feedIngredients as never,
      platformFlags as never
    );

    return { service, prisma, platformFlags, offers };
  }

  it("refuse si flag mills OFF", async () => {
    const { service } = build({ millsActive: false });
    await expect(service.listMine(user)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it("refuse si profil non-moulin", async () => {
    const { service } = build({
      millsActive: true,
      merchantKind: MerchantKind.standard
    });
    await expect(service.listMine(user)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("crée une offre et calcule unitToKg + pricePerKg", async () => {
    const { service, prisma } = build({ millsActive: true });
    const dto = await service.create(user, {
      feedIngredientId: "ing-1",
      pricePerUnit: 25000,
      packaging: MillIngredientPackaging.sack_50kg,
      stockQuantity: 20,
      mixingCostPerKg: 50,
      isPubliclyListed: false
    });
    expect(dto.unitToKg).toBe(50);
    expect(dto.pricePerKg).toBe(500);
    expect(dto.isPubliclyListed).toBe(false);
    expect(dto.feedIngredientId).toBe("ing-1");
    // Offre privée : pas de création produit marketplace
    expect(prisma.merchantProduct.create).not.toHaveBeenCalled();
  });

  it("offre publique → synchronise MerchantProduct publié", async () => {
    const { service, prisma } = build({ millsActive: true });
    const dto = await service.create(user, {
      feedIngredientId: "ing-1",
      pricePerUnit: 1000,
      packaging: MillIngredientPackaging.kg,
      stockQuantity: 100,
      isPubliclyListed: true
    });
    expect(prisma.merchantProduct.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          photoUrls: ["fermier-icon:cereal"]
        })
      })
    );
    expect(prisma.merchantProduct.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "published" })
      })
    );
    expect(dto.merchantProductId).toBeTruthy();
  });
});
