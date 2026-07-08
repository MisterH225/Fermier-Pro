import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import {
  cleanupE2eFixtures,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";
import { ensureBuyerMerchantFavoriteTable } from "./helpers/ensure-buyer-merchant-favorites";
import {
  createListingAnimal,
  seedBuyerFarm
} from "./helpers/marketplace-delivery-e2e";
import {
  chooseFreeSubscription,
  cleanupMerchantE2E,
  createMerchantProduct,
  createMerchantShop,
  publishProduct,
  seedMerchantE2E,
  type MerchantE2ECtx
} from "./helpers/merchant-shop-e2e";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Marketplace feed unifié (e2e)", () => {
  let app: NestExpressApplication;
  let base: E2ESeedResult;
  let merchant: MerchantE2ECtx;
  let pigListingId: string;
  let merchantProductId: string;
  let buyerFarmId: string | undefined;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    base = await seedE2eFixtures(PrismaClient);
    await ensureBuyerMerchantFavoriteTable(base.prisma);
    app = await createTestApp();
    merchant = await seedMerchantE2E(base.prisma, base);

    await createMerchantShop(app, merchant);
    await chooseFreeSubscription(app, merchant);

    const product = await createMerchantProduct(
      app,
      merchant,
      "Produit feed unifié E2E"
    );
    const published = await publishProduct(app, merchant, product.body.id);
    expect(published.status).toBe(201);
    merchantProductId = product.body.id as string;

    const animalId = await createListingAnimal(base.prisma, base.farmId);
    const listingRes = await request(app.getHttpServer())
      .post("/api/v1/marketplace/listings")
      .set("Authorization", `Bearer ${base.token}`)
      .set("X-Profile-Id", base.producerProfileId)
      .send({
        title: "Porc feed unifié E2E",
        farmId: base.farmId,
        animalId,
        category: "butcher",
        pricePerKg: 3_000,
        totalPrice: 75_000,
        totalWeightKg: 25,
        weightBasis: "live"
      });
    expect(listingRes.status).toBe(201);
    pigListingId = listingRes.body.id as string;

    const publishListing = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/listings/${pigListingId}/publish`)
      .set("Authorization", `Bearer ${base.token}`)
      .set("X-Profile-Id", base.producerProfileId)
      .send({ durationDays: 14 });
    expect(publishListing.status).toBe(201);
  });

  afterAll(async () => {
    if (merchant) {
      await cleanupMerchantE2E(base.prisma, merchant, base);
    }
    if (buyerFarmId) {
      await base.prisma.farm.deleteMany({ where: { id: buyerFarmId } });
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

  it("GET /marketplace/listings — mélange porcs et produits commerçants", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/marketplace/listings")
      .set("Authorization", `Bearer ${base.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const pig = res.body.find((row: { id: string }) => row.id === pigListingId);
    const product = res.body.find(
      (row: { id: string }) => row.id === merchantProductId
    );
    expect(pig).toBeDefined();
    expect(pig.kind).toBe("listing");
    expect(product).toBeDefined();
    expect(product.kind).toBe("merchant");
    expect(product.title).toBe("Produit feed unifié E2E");
  });

  it("GET /marketplace/listings?category=butcher — porcs uniquement", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/marketplace/listings")
      .query({ category: "butcher" })
      .set("Authorization", `Bearer ${base.token}`);
    expect(res.status).toBe(200);
    expect(res.body.some((row: { id: string }) => row.id === pigListingId)).toBe(
      true
    );
    expect(
      res.body.some((row: { id: string }) => row.id === merchantProductId)
    ).toBe(false);
    expect(res.body.every((row: { kind?: string }) => row.kind !== "merchant")).toBe(
      true
    );
  });

  it("GET /marketplace/listings?category=alimentation-e2e — produits boutique uniquement", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/marketplace/listings")
      .query({ category: "alimentation-e2e" })
      .set("Authorization", `Bearer ${base.token}`);
    expect(res.status).toBe(200);
    expect(
      res.body.some((row: { id: string }) => row.id === merchantProductId)
    ).toBe(true);
    expect(res.body.some((row: { id: string }) => row.id === pigListingId)).toBe(
      false
    );
    expect(res.body.every((row: { kind?: string }) => row.kind === "merchant")).toBe(
      true
    );
  });

  it("GET /marketplace/listings/categories — groupes porc + commerçant", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/marketplace/listings/categories")
      .set("Authorization", `Bearer ${base.token}`);
    expect(res.status).toBe(200);
    expect(res.body.pig).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "piglet" }),
        expect.objectContaining({ id: "butcher" })
      ])
    );
    expect(res.body.merchant).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "alimentation-e2e", label: "Alimentation" })
      ])
    );
  });

  it("favoris produit commerçant — POST/GET/DELETE", async () => {
    buyerFarmId = await seedBuyerFarm(base.prisma, base.peerUserId);

    const add = await request(app.getHttpServer())
      .post("/api/v1/buyers/me/favorites/products")
      .set("Authorization", `Bearer ${base.peerToken}`)
      .send({ productId: merchantProductId });
    expect(add.status).toBe(201);
    expect(add.body.productId).toBe(merchantProductId);

    const ids = await request(app.getHttpServer())
      .get("/api/v1/buyers/me/favorites/ids")
      .set("Authorization", `Bearer ${base.peerToken}`);
    expect(ids.status).toBe(200);
    expect(ids.body.productIds).toContain(merchantProductId);

    const del = await request(app.getHttpServer())
      .delete(
        `/api/v1/buyers/me/favorites/products/${merchantProductId}`
      )
      .set("Authorization", `Bearer ${base.peerToken}`);
    expect(del.status).toBe(200);

    const idsAfter = await request(app.getHttpServer())
      .get("/api/v1/buyers/me/favorites/ids")
      .set("Authorization", `Bearer ${base.peerToken}`);
    expect(idsAfter.body.productIds).not.toContain(merchantProductId);
  });
});
