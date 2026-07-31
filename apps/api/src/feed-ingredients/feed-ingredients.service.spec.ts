import { BadRequestException, ConflictException } from "@nestjs/common";
import { FeedIngredientCategory } from "@prisma/client";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { AUDIT_ACTION } from "../common/audit.constants";
import { CreateFeedIngredientDto } from "./dto/feed-ingredient.dto";
import { FeedIngredientsService } from "./feed-ingredients.service";
// JSON (pas le .ts seed) : un import hors `src/` dans le programme tsc
// déplace l'emit Nest vers `dist/src/main.js` et casse start-api sur Railway.
import FEED_INGREDIENTS_SEED from "../../prisma/seed-data/feed-ingredients.json";

function row(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-07-31T00:00:00.000Z");
  return {
    id: "ing-1",
    canonicalName: "Maïs jaune",
    aliases: ["mais", "corn"],
    category: FeedIngredientCategory.cereal,
    crudeProteinPct: 8.5,
    metabolizableEnergyKcal: 3300,
    lysinePct: 0.25,
    methioninePct: 0.18,
    calciumPct: 0.02,
    phosphorusPct: 0.27,
    crudeFiberPct: 2.2,
    fatPct: 3.8,
    dryMatterPct: 86,
    isActive: true,
    isPremix: false,
    notes: null,
    reviewedAt: null,
    reviewedBy: null,
    createdBy: "admin",
    updatedBy: "admin",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("FeedIngredientsService", () => {
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const auditRecord = jest.fn().mockResolvedValue(undefined);

  const prisma = {
    feedIngredient: { findMany, findUnique, create, update }
  };

  let service: FeedIngredientsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FeedIngredientsService(
      prisma as never,
      { record: auditRecord } as never
    );
  });

  it("seed contient les intrants attendus (idempotence sur canonicalName)", () => {
    const names = FEED_INGREDIENTS_SEED.map((r) => r.canonicalName);
    expect(names).toEqual(
      expect.arrayContaining([
        "Maïs jaune",
        "Tourteau de soja",
        "Farine de poisson",
        "Huile de palme",
        "Son de riz gras",
        "Lysine",
        "Méthionine"
      ])
    );
    expect(new Set(names).size).toBe(names.length);
    expect(FEED_INGREDIENTS_SEED.length).toBe(22);
  });

  it("recherche par alias normalisé", async () => {
    findMany.mockResolvedValue([row()]);
    const list = await service.list({ q: "CORN", includeInactive: true });
    expect(list).toHaveLength(1);
    expect(list[0].canonicalName).toBe("Maïs jaune");
  });

  it("création audite et refuse un doublon d'alias", async () => {
    findMany.mockResolvedValue([row()]);
    await expect(
      service.create(
        {
          canonicalName: "Corn grain",
          aliases: ["mais"],
          category: FeedIngredientCategory.cereal,
          crudeProteinPct: 8,
          metabolizableEnergyKcal: 3200,
          lysinePct: 0.2,
          methioninePct: 0.1,
          calciumPct: 0,
          phosphorusPct: 0.2,
          crudeFiberPct: 2,
          fatPct: 3,
          dryMatterPct: 86
        },
        "admin-1"
      )
    ).rejects.toBeInstanceOf(ConflictException);

    findMany.mockResolvedValue([]);
    create.mockResolvedValue(row({ id: "ing-new", canonicalName: "Sorgho" }));
    const created = await service.create(
      {
        canonicalName: "Sorgho",
        aliases: ["sorghum"],
        category: FeedIngredientCategory.cereal,
        crudeProteinPct: 10,
        metabolizableEnergyKcal: 3100,
        lysinePct: 0.2,
        methioninePct: 0.15,
        calciumPct: 0.03,
        phosphorusPct: 0.3,
        crudeFiberPct: 2.5,
        fatPct: 3,
        dryMatterPct: 87
      },
      "admin-1"
    );
    expect(created.canonicalName).toBe("Sorgho");
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTION.feedIngredientCreated,
        resourceType: "FeedIngredient"
      })
    );
  });

  it("désactivation conserve la ligne (isActive=false) et audite", async () => {
    findUnique.mockResolvedValue(row({ isActive: true }));
    findMany.mockResolvedValue([]);
    update.mockResolvedValue(row({ isActive: false }));

    const deactivated = await service.deactivate("ing-1", "admin-1");
    expect(deactivated.isActive).toBe(false);
    expect(update).toHaveBeenCalledWith({
      where: { id: "ing-1" },
      data: expect.objectContaining({ isActive: false, updatedBy: "admin-1" })
    });
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTION.feedIngredientDeactivated
      })
    );

    findMany.mockResolvedValue([]);
    await service.list({ includeInactive: false });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true })
      })
    );

    findMany.mockResolvedValue([row({ isActive: false })]);
    const withInactive = await service.list({ includeInactive: true });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
    expect(withInactive).toHaveLength(1);
    expect(withInactive[0].isActive).toBe(false);
  });

  it("validation des bornes nutritionnelles (DTO)", async () => {
    const invalid = plainToInstance(CreateFeedIngredientDto, {
      canonicalName: "X",
      category: "cereal",
      crudeProteinPct: 150,
      metabolizableEnergyKcal: -10,
      lysinePct: 0,
      methioninePct: 0,
      calciumPct: 0,
      phosphorusPct: 0,
      crudeFiberPct: 0,
      fatPct: 0,
      dryMatterPct: 0
    });
    const errors = await validate(invalid);
    const props = errors.map((e) => e.property);
    expect(props).toEqual(
      expect.arrayContaining(["crudeProteinPct", "metabolizableEnergyKcal"])
    );
  });

  it("findActiveByNameOrAlias ignore les désactivés", async () => {
    findMany.mockResolvedValue([row({ isActive: true })]);
    await expect(service.findActiveByNameOrAlias("mais")).resolves.toMatchObject(
      { canonicalName: "Maïs jaune" }
    );
    findMany.mockResolvedValue([]);
    await expect(service.findActiveByNameOrAlias("mais")).resolves.toBeNull();
  });

  it("refuse un nom vide après normalisation", async () => {
    findMany.mockResolvedValue([]);
    await expect(
      service.create(
        {
          canonicalName: "!!!",
          category: FeedIngredientCategory.cereal,
          crudeProteinPct: 1,
          metabolizableEnergyKcal: 100,
          lysinePct: 0,
          methioninePct: 0,
          calciumPct: 0,
          phosphorusPct: 0,
          crudeFiberPct: 0,
          fatPct: 0,
          dryMatterPct: 90
        },
        "admin"
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("création admin pose reviewedAt ; désactivation seule ne le pose pas", async () => {
    findMany.mockResolvedValue([]);
    create.mockResolvedValue(
      row({
        id: "ing-new",
        canonicalName: "Sorgho",
        reviewedAt: new Date("2026-07-31T12:00:00.000Z"),
        reviewedBy: "admin-1"
      })
    );
    const created = await service.create(
      {
        canonicalName: "Sorgho",
        aliases: ["sorghum"],
        category: FeedIngredientCategory.cereal,
        crudeProteinPct: 10,
        metabolizableEnergyKcal: 3100,
        lysinePct: 0.2,
        methioninePct: 0.15,
        calciumPct: 0.03,
        phosphorusPct: 0.3,
        crudeFiberPct: 2.5,
        fatPct: 3,
        dryMatterPct: 87
      },
      "admin-1"
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reviewedAt: expect.any(Date),
        reviewedBy: "admin-1"
      })
    });
    expect(created.reviewedAt).toBe("2026-07-31T12:00:00.000Z");
    expect(created.reviewedBy).toBe("admin-1");

    findUnique.mockResolvedValue(row({ isActive: true, reviewedAt: null }));
    findMany.mockResolvedValue([]);
    update.mockResolvedValue(row({ isActive: false, reviewedAt: null }));
    await service.deactivate("ing-1", "admin-1");
    expect(update).toHaveBeenCalledWith({
      where: { id: "ing-1" },
      data: expect.not.objectContaining({ reviewedAt: expect.any(Date) })
    });
  });

  it("markReviewed et édition nutritionnelle renseignent reviewedAt", async () => {
    findUnique.mockResolvedValue(row({ reviewedAt: null }));
    findMany.mockResolvedValue([]);
    update.mockResolvedValue(
      row({
        reviewedAt: new Date("2026-07-31T15:00:00.000Z"),
        reviewedBy: "admin-1"
      })
    );

    const reviewed = await service.markReviewed("ing-1", "admin-1");
    expect(update).toHaveBeenCalledWith({
      where: { id: "ing-1" },
      data: expect.objectContaining({
        reviewedAt: expect.any(Date),
        reviewedBy: "admin-1"
      })
    });
    expect(reviewed.reviewedAt).toBe("2026-07-31T15:00:00.000Z");

    findUnique.mockResolvedValue(row({ reviewedAt: null }));
    update.mockResolvedValue(
      row({
        crudeProteinPct: 9,
        reviewedAt: new Date("2026-07-31T16:00:00.000Z"),
        reviewedBy: "admin-1"
      })
    );
    await service.update("ing-1", { crudeProteinPct: 9 }, "admin-1");
    expect(update).toHaveBeenCalledWith({
      where: { id: "ing-1" },
      data: expect.objectContaining({
        crudeProteinPct: 9,
        reviewedAt: expect.any(Date),
        reviewedBy: "admin-1"
      })
    });
  });
});
