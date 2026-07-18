import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient, MerchantProductStatus } from "@prisma/client";
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
  createMerchantProduct,
  createMerchantShop,
  publishProduct,
  seedMerchantE2E,
  type MerchantE2ECtx
} from "./helpers/merchant-shop-e2e";
import { MerchantSubscriptionService } from "../src/merchant-shop/merchant-subscription.service";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Merchant shop (e2e)", () => {
  let app: NestExpressApplication;
  let base: E2ESeedResult;
  let merchant: MerchantE2ECtx;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    base = await seedE2eFixtures(PrismaClient);
    app = await createTestApp();
    merchant = await seedMerchantE2E(base.prisma, base);

    await base.prisma.userWallet.upsert({
      where: { userId: base.peerUserId },
      create: { userId: base.peerUserId, balance: 500_000 },
      update: { balance: 500_000 }
    });
  });

  afterAll(async () => {
    if (merchant) {
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

  it("skip abonnement + skip boutique → flags onboarding", async () => {
    const patch = await request(app.getHttpServer())
      .patch("/api/v1/merchant/me/onboarding")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId)
      .send({ shopSkipped: true });
    expect(patch.status).toBe(200);
    expect(patch.body.shopSkipped).toBe(true);
    expect(patch.body.subscriptionTier).toBeNull();
  });

  it("GET /merchant/categories — liste non vide (défauts si besoin)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/merchant/categories")
      .set("Authorization", `Bearer ${merchant.merchantToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String)
    });
  });

  it("publication sans abonnement → SUBSCRIPTION_REQUIRED", async () => {
    const shopRes = await createMerchantShop(app, merchant);
    expect(shopRes.status).toBe(201);

    const me = await request(app.getHttpServer())
      .get("/api/v1/merchant/me")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId);
    expect(me.status).toBe(200);
    expect(me.body.shopCount).toBe(1);
    expect(me.body.shops).toHaveLength(1);
    expect(me.body.shops[0].id).toBe(merchant.shopId);
    expect(me.body.shops[0].name).toBe("Boutique E2E");

    const productDraft = await createMerchantProduct(app, merchant, "Produit brouillon");
    expect(productDraft.status).toBe(201);
    expect(productDraft.body.shopId).toBe(merchant.shopId);

    const product = await createMerchantProduct(app, merchant, "Produit sans abo");
    const publish = await publishProduct(app, merchant, product.body.id);
    expect(publish.status).toBe(403);
    expect(publish.body.code).toBe("SUBSCRIPTION_REQUIRED");
  });

  it("abonnement choisi → publication OK", async () => {
    const sub = await chooseFreeSubscription(app, merchant);
    expect(sub.status).toBe(201);
    expect(sub.body.subscriptionTier).toBe("free");
    expect(sub.body.pendingSubscription).toBeNull();
    expect(sub.body.pendingRenewal).toBeNull();
    const product = await createMerchantProduct(app, merchant, "Produit pub");
    const publish = await publishProduct(app, merchant, product.body.id);
    expect(publish.status).toBe(201);
    expect(publish.body.status).toBe("published");
  });

  it("DELETE /merchant/products/:id — soft-delete commerçant", async () => {
    const product = await createMerchantProduct(app, merchant, "Produit à supprimer");
    expect(product.status).toBe(201);
    const productId = product.body.id as string;

    const del = await request(app.getHttpServer())
      .delete(`/api/v1/merchant/products/${productId}`)
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
    expect(del.body.id).toBe(productId);

    const list = await request(app.getHttpServer())
      .get("/api/v1/merchant/products")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId);
    expect(list.status).toBe(200);
    expect(list.body.map((p: { id: string }) => p.id)).not.toContain(productId);

    const row = await base.prisma.merchantProduct.findUnique({
      where: { id: productId }
    });
    expect(row?.status).toBe(MerchantProductStatus.disabled);
    expect(row?.disabledReason).toBe("merchant_deleted");
  });

  it("free bloque 6e produit actif", async () => {
    const published = await base.prisma.merchantProduct.count({
      where: {
        shopId: merchant.shopId,
        status: MerchantProductStatus.published
      }
    });
    for (let i = published; i < 5; i += 1) {
      const p = await createMerchantProduct(app, merchant, `LimitP${i}`);
      await publishProduct(app, merchant, p.body.id);
    }
    const sixth = await createMerchantProduct(app, merchant, "LimitP6");
    const blocked = await publishProduct(app, merchant, sixth.body.id);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("ACTIVE_PRODUCT_LIMIT");
  });

  it("downgrade premium→free garde 5 actifs", async () => {
    await base.prisma.merchantProfile.update({
      where: { userId: merchant.merchantUserId },
      data: { subscriptionTier: "premium" }
    });
    const extra = await createMerchantProduct(app, merchant, "Premium extra");
    await publishProduct(app, merchant, extra.body.id);

    const subscription = app.get(MerchantSubscriptionService);
    await subscription.downgradeToFree(merchant.merchantUserId);

    const products = await base.prisma.merchantProduct.findMany({
      where: { shopId: merchant.shopId },
      orderBy: { createdAt: "asc" }
    });
    const published = products.filter(
      (p) => p.status === MerchantProductStatus.published
    );
    const disabled = products.filter(
      (p) => p.status === MerchantProductStatus.disabled
    );
    expect(published.length).toBe(5);
    expect(disabled.length).toBeGreaterThanOrEqual(1);
  });

  it("swap respecte limite 5 actifs", async () => {
    const disabled = await base.prisma.merchantProduct.findFirst({
      where: {
        shopId: merchant.shopId,
        status: MerchantProductStatus.disabled,
        // Exclure les soft-deletes commerçant (non swappables).
        OR: [
          { disabledReason: null },
          { disabledReason: { not: "merchant_deleted" } }
        ]
      }
    });
    if (!disabled) return;
    const swap = await request(app.getHttpServer())
      .post(`/api/v1/merchant/products/${disabled.id}/swap-active`)
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId);
    expect(swap.status).toBe(201);
    const active = await base.prisma.merchantProduct.count({
      where: {
        shopId: merchant.shopId,
        status: MerchantProductStatus.published
      }
    });
    expect(active).toBeLessThanOrEqual(5);
  });

  it("catalog public : filtres, tri et pagination", async () => {
    const list = await request(app.getHttpServer())
      .get("/api/v1/merchant/catalog/products")
      .set("Authorization", `Bearer ${base.peerToken}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.length).toBeGreaterThan(0);

    const byCategory = await request(app.getHttpServer())
      .get(`/api/v1/merchant/catalog/products?categoryId=${merchant.categoryId}`)
      .set("Authorization", `Bearer ${base.peerToken}`);
    expect(byCategory.status).toBe(200);
    expect(byCategory.body.items.every((p: { categoryId: string }) => p.categoryId === merchant.categoryId)).toBe(
      true
    );

    const search = await request(app.getHttpServer())
      .get("/api/v1/merchant/catalog/products?q=LimitP")
      .set("Authorization", `Bearer ${base.peerToken}`);
    expect(search.status).toBe(200);
    expect(search.body.items.length).toBeGreaterThan(0);

    const sorted = await request(app.getHttpServer())
      .get("/api/v1/merchant/catalog/products?sort=price_asc&limit=3")
      .set("Authorization", `Bearer ${base.peerToken}`);
    expect(sorted.status).toBe(200);
    const prices = sorted.body.items.map((p: { price: number }) => p.price);
    for (let i = 1; i < prices.length; i += 1) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]!);
    }

    if (sorted.body.nextCursor) {
      const page2 = await request(app.getHttpServer())
        .get(`/api/v1/merchant/catalog/products?cursor=${sorted.body.nextCursor}&limit=3`)
        .set("Authorization", `Bearer ${base.peerToken}`);
      expect(page2.status).toBe(200);
      expect(page2.body.items.length).toBeGreaterThan(0);
    }
  });

  it("dashboard commerçant : KPIs et alertes", async () => {
    const dash = await request(app.getHttpServer())
      .get("/api/v1/merchant/dashboard")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId);
    expect(dash.status).toBe(200);
    expect(dash.body.kpis).toMatchObject({
      monthRevenueXof: expect.any(Number),
      pendingOrders: expect.any(Number),
      productViews: expect.any(Number)
    });
    expect(Array.isArray(dash.body.lowStockProducts)).toBe(true);
    expect(Array.isArray(dash.body.moderationEvents)).toBe(true);
  });

  it("achat — 400 si paymentMethod absent", async () => {
    const published = await base.prisma.merchantProduct.findFirst({
      where: {
        shopId: merchant.shopId,
        status: MerchantProductStatus.published,
        stock: { gt: 0 }
      }
    });
    expect(published).toBeTruthy();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/merchant/catalog/products/${published!.id}/purchase`)
      .set("Authorization", `Bearer ${base.peerToken}`)
      .send({ quantity: 1 });
    expect(res.status).toBe(400);
  });

  it("achat : stock, paiement, commission, chat", async () => {
    const published = await base.prisma.merchantProduct.findFirst({
      where: {
        shopId: merchant.shopId,
        status: MerchantProductStatus.published,
        stock: { gt: 0 }
      }
    });
    expect(published).toBeTruthy();
    const beforeStock = published!.stock;

    const purchase = await request(app.getHttpServer())
      .post(`/api/v1/merchant/catalog/products/${published!.id}/purchase`)
      .set("Authorization", `Bearer ${base.peerToken}`)
      .send({ quantity: 1, paymentMethod: "wallet" });
    expect(purchase.status).toBe(201);

    const confirm = await request(app.getHttpServer())
      .post(
        `/api/v1/merchant/catalog/orders/${purchase.body.orderId}/payment/confirm`
      )
      .set("Authorization", `Bearer ${base.peerToken}`)
      .send({ providerRef: purchase.body.providerRef });
    expect(confirm.status).toBe(201);
    expect(confirm.body.status).toBe("paid");
    expect(confirm.body.escrowHeld).toBe(true);

    const after = await base.prisma.merchantProduct.findUniqueOrThrow({
      where: { id: published!.id }
    });
    expect(after.stock).toBe(beforeStock - 1);

    // Commission différée à la clôture escrow (pas au payment/confirm).
    const orderId = confirm.body.id as string;
    expect(
      await base.prisma.platformRevenue.findFirst({
        where: { merchantOrderId: orderId }
      })
    ).toBeNull();

    // Avancer jusqu'à delivered sans passer par confirmOrder (chat peut bloquer en e2e).
    await base.prisma.merchantOrder.update({
      where: { id: orderId },
      data: {
        status: "delivered",
        confirmedAt: new Date(),
        shippedAt: new Date(),
        deliveredAt: new Date(),
        timeoutAt: null
      }
    });
    const complete = await request(app.getHttpServer())
      .post(`/api/v1/merchant/orders/${orderId}/complete`)
      .set("Authorization", `Bearer ${base.peerToken}`);
    expect([200, 201]).toContain(complete.status);

    const revenue = await base.prisma.platformRevenue.findFirst({
      where: { merchantOrderId: orderId }
    });
    expect(revenue).toBeTruthy();

    const chat = await request(app.getHttpServer())
      .post("/api/v1/chat/rooms/direct")
      .set("Authorization", `Bearer ${base.peerToken}`)
      .send({
        peerUserId: merchant.merchantUserId,
        merchantProductId: published!.id
      });
    expect(chat.status).toBe(201);
  });

  it("détail commande vendeur et acheteur", async () => {
    // La commande du test précédent peut être completed (escrow clôturé).
    const order = await base.prisma.merchantOrder.findFirst({
      where: {
        sellerUserId: merchant.merchantUserId,
        status: { in: ["paid", "completed", "delivered", "confirmed", "shipping"] }
      },
      orderBy: { createdAt: "desc" }
    });
    expect(order).toBeTruthy();

    const sellerDetail = await request(app.getHttpServer())
      .get(`/api/v1/merchant/orders/${order!.id}`)
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId);
    expect(sellerDetail.status).toBe(200);
    expect(sellerDetail.body.id).toBe(order!.id);
    expect(sellerDetail.body.sellerNet).toBeGreaterThan(0);
    expect(sellerDetail.body.productName).toBeTruthy();

    const buyerDetail = await request(app.getHttpServer())
      .get(`/api/v1/merchant/orders/${order!.id}`)
      .set("Authorization", `Bearer ${base.peerToken}`);
    expect(buyerDetail.status).toBe(200);
    expect(buyerDetail.body.buyerUserId).toBe(base.peerUserId);
  });

  it("modération admin : log + produit retiré", async () => {
    await base.prisma.superAdmin.upsert({
      where: { userId: base.userId },
      create: { userId: base.userId },
      update: {}
    });
    const product = await base.prisma.merchantProduct.findFirst({
      where: { shopId: merchant.shopId }
    });
    expect(product).toBeTruthy();

    const del = await request(app.getHttpServer())
      .delete(`/api/v1/admin/merchant/products/${product!.id}`)
      .set("Authorization", `Bearer ${base.token}`)
      .send({ reason: "Contenu non conforme E2E" });
    expect(del.status).toBe(200);

    const log = await base.prisma.merchantProductModerationLog.findFirst({
      where: { productId: product!.id }
    });
    expect(log).toBeTruthy();
    const updated = await base.prisma.merchantProduct.findUniqueOrThrow({
      where: { id: product!.id }
    });
    expect(updated.status).toBe(MerchantProductStatus.moderated_removed);
  });
});
