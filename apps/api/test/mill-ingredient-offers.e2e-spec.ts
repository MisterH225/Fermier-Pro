import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  MerchantKind,
  MerchantProductStatus,
  MillIngredientPackaging,
  PrismaClient
} from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import {
  cleanupE2eFixtures,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";
import {
  chooseFreeSubscription,
  cleanupMerchantE2E,
  seedMerchantE2E,
  type MerchantE2ECtx
} from "./helpers/merchant-shop-e2e";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Mill ingredient offers (e2e)", () => {
  let app: NestExpressApplication;
  let base: E2ESeedResult;
  let merchant: MerchantE2ECtx;
  let ingredientId: string;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    base = await seedE2eFixtures(PrismaClient);
    app = await createTestApp();
    merchant = await seedMerchantE2E(base.prisma, base);

    await base.prisma.merchantProfile.update({
      where: { userId: merchant.merchantUserId },
      data: { merchantKind: MerchantKind.mill }
    });

    const ing = await base.prisma.feedIngredient.upsert({
      where: { canonicalName: "Maïs E2E Moulin" },
      create: {
        canonicalName: "Maïs E2E Moulin",
        aliases: ["mais-e2e-moulin", "corn-e2e"],
        category: "cereal",
        crudeProteinPct: 8,
        metabolizableEnergyKcal: 3300,
        lysinePct: 0.25,
        methioninePct: 0.18,
        calciumPct: 0.02,
        phosphorusPct: 0.3,
        crudeFiberPct: 2.5,
        fatPct: 4,
        dryMatterPct: 86
      },
      update: { isActive: true, aliases: ["mais-e2e-moulin", "corn-e2e"] }
    });
    ingredientId = ing.id;

    await chooseFreeSubscription(app, merchant);
  });

  afterAll(async () => {
    if (merchant) {
      await base.prisma.millIngredientOffer.deleteMany({
        where: { millProfile: { userId: merchant.merchantUserId } }
      });
      await cleanupMerchantE2E(base.prisma, merchant, base);
    }
    if (app) await app.close();
    if (base?.prisma) {
      await cleanupE2eFixtures(base.prisma, {
        farmId: base.farmId,
        userId: base.userId,
        peerUserId: base.peerUserId
      });
    }
  });

  afterEach(async () => {
    await base.prisma.featureFlagTestAccount.deleteMany({
      where: { moduleId: "mills", userId: merchant.merchantUserId }
    });
    await base.prisma.millIngredientOffer.deleteMany({
      where: { millProfile: { userId: merchant.merchantUserId } }
    });
  });

  async function enableMills() {
    await base.prisma.featureFlagTestAccount.create({
      data: { moduleId: "mills", userId: merchant.merchantUserId }
    });
  }

  it("flag mills OFF → 503", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/merchant/mill/offers")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("MODULE_INACTIVE");
  });

  it("création offre privée — invisible marketplace, lien FeedIngredient", async () => {
    await enableMills();

    const create = await request(app.getHttpServer())
      .post("/api/v1/merchant/mill/offers")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId)
      .send({
        feedIngredientId: ingredientId,
        pricePerUnit: 25000,
        packaging: MillIngredientPackaging.sack_50kg,
        stockQuantity: 40,
        mixingCostPerKg: 30,
        isPubliclyListed: false
      });
    expect(create.status).toBe(201);
    expect(create.body.unitToKg).toBe(50);
    expect(create.body.pricePerKg).toBe(500);
    expect(create.body.feedIngredientId).toBe(ingredientId);
    expect(create.body.isPubliclyListed).toBe(false);
    expect(create.body.merchantProductId).toBeNull();

    const feed = await request(app.getHttpServer())
      .get("/api/v1/marketplace/listings")
      .set("Authorization", `Bearer ${base.peerToken}`)
      .query({ category: "alimentation", q: "Maïs E2E Moulin" });
    expect(feed.status).toBe(200);
    const hit = (feed.body as Array<{ title?: string; kind?: string }>).find(
      (r) => r.title === "Maïs E2E Moulin"
    );
    expect(hit).toBeUndefined();
  });

  it("offre publique → bulk_feed + commandable via flux marchand", async () => {
    await enableMills();

    const create = await request(app.getHttpServer())
      .post("/api/v1/merchant/mill/offers")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId)
      .send({
        feedIngredientId: ingredientId,
        pricePerUnit: 1200,
        packaging: MillIngredientPackaging.kg,
        stockQuantity: 80,
        isPubliclyListed: true
      });
    expect(create.status).toBe(201);
    expect(create.body.merchantProductId).toBeTruthy();
    const productId = create.body.merchantProductId as string;

    const product = await base.prisma.merchantProduct.findUniqueOrThrow({
      where: { id: productId }
    });
    expect(product.status).toBe(MerchantProductStatus.published);
    expect(Number(product.price)).toBe(1200);
    expect(product.stock).toBe(80);

    const feed = await request(app.getHttpServer())
      .get("/api/v1/marketplace/listings")
      .set("Authorization", `Bearer ${base.peerToken}`)
      .query({ category: "alimentation" });
    expect(feed.status).toBe(200);
    const hit = (
      feed.body as Array<{
        id: string;
        kind?: string;
        feedIngredientId?: string | null;
      }>
    ).find((r) => r.id === productId);
    expect(hit).toBeTruthy();
    expect(hit!.kind).toBe("bulk_feed");
    expect(hit!.feedIngredientId).toBe(ingredientId);

    // Modération applicable (produit marchand standard)
    await base.prisma.superAdmin.upsert({
      where: { userId: base.userId },
      create: { userId: base.userId },
      update: {}
    });
    const del = await request(app.getHttpServer())
      .delete(`/api/v1/admin/merchant/products/${productId}`)
      .set("Authorization", `Bearer ${base.token}`)
      .send({ reason: "Test modération gros moulin" });
    expect(del.status).toBe(200);

    const after = await base.prisma.merchantProduct.findUniqueOrThrow({
      where: { id: productId }
    });
    expect(after.status).toBe(MerchantProductStatus.moderated_removed);

    const adminOffers = await request(app.getHttpServer())
      .get("/api/v1/admin/mill/offers")
      .set("Authorization", `Bearer ${base.token}`);
    expect(adminOffers.status).toBe(200);
    expect(
      (adminOffers.body as Array<{ feedIngredientId: string }>).some(
        (o) => o.feedIngredientId === ingredientId
      )
    ).toBe(true);
  });

  it("recherche intrant par alias", async () => {
    await enableMills();
    const res = await request(app.getHttpServer())
      .get("/api/v1/merchant/mill/ingredients")
      .query({ q: "mais-e2e" })
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId);
    expect(res.status).toBe(200);
    expect(
      (res.body as Array<{ id: string }>).some((r) => r.id === ingredientId)
    ).toBe(true);
  });
});
