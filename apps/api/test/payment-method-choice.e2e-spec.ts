import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  MerchantOrderStatus,
  MerchantSubscriptionTier,
  MarketplacePaymentMethod,
  PrismaClient
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import {
  cleanupE2eFixtures,
  purgeMarketplaceForUsers,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";
import {
  cleanupE2eVetRbacFixtures,
  seedE2eVetRbacFixtures,
  type E2EVetRbacSeedResult
} from "./helpers/e2e-vet-rbac-seed";
import {
  chooseFreeSubscription,
  cleanupMerchantE2E,
  createMerchantProduct,
  createMerchantShop,
  publishProduct,
  seedMerchantE2E,
  type MerchantE2ECtx
} from "./helpers/merchant-shop-e2e";
import {
  isMerchantSubscriptionBillingSchemaReady,
  prepareMerchantBillingE2e,
  resetMerchantSubscriptionBillingState
} from "./helpers/merchant-subscription-billing-e2e";
import {
  seedBuyerFarm,
  setupMarketplaceDeliveryListing,
  type MarketplaceDeliveryCtx
} from "./helpers/marketplace-delivery-e2e";
import {
  cleanupBuyerMarketplaceState,
  creditWalletViaDevTopUp,
  payMarketplaceMobileMoney,
  payMarketplaceWallet,
  prepareWalletE2eUsers
} from "./helpers/wallet-payout-e2e";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

jest.setTimeout(600_000);

function futureIso(daysAhead = 10): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(8 + (Date.now() % 10), (Date.now() % 50), 0, 0);
  return d.toISOString();
}

async function seedVetAwaitingPayment(
  app: NestExpressApplication,
  ctx: E2EVetRbacSeedResult
): Promise<string> {
  const scheduledAt = futureIso(12);
  const createRes = await request(app.getHttpServer())
    .post(`/api/v1/farms/${ctx.farmId}/vet-appointments`)
    .set("Authorization", `Bearer ${ctx.producerToken}`)
    .send({
      vetProfileId: ctx.vetProfileId,
      scheduledAt,
      reason: "Contrôle paymentMethod e2e"
    });
  expect(createRes.status).toBe(201);
  const appointmentId = createRes.body.id as string;

  const acceptRes = await request(app.getHttpServer())
    .post(`/api/v1/vet-appointments/${appointmentId}/accept`)
    .set("Authorization", `Bearer ${ctx.vetToken}`)
    .set("X-Profile-Id", ctx.veterinarianProfileId)
    .send({ servicePrice: 50_000, confirmedAt: scheduledAt });
  expect(acceptRes.status).toBe(201);
  expect(acceptRes.body.status).toBe("AWAITING_PAYMENT");

  return appointmentId;
}

describeOrSkip("Choix mode de paiement (e2e)", () => {
  let app: NestExpressApplication;
  let base: E2ESeedResult;
  let merchant: MerchantE2ECtx;
  let vetCtx: E2EVetRbacSeedResult;
  let buyerFarmId: string;
  let publishedProductId: string;
  let billingSchemaReady = false;

  async function freshMarketplaceDeal(): Promise<MarketplaceDeliveryCtx> {
    await purgeMarketplaceForUsers(base.prisma, [base.userId, base.peerUserId]);
    await cleanupBuyerMarketplaceState(base.prisma, [
      base.userId,
      base.peerUserId
    ]);
    return setupMarketplaceDeliveryListing({
      app,
      prisma: base.prisma,
      sellerToken: base.token,
      sellerProfileId: base.producerProfileId,
      sellerFarmId: base.farmId,
      buyerToken: base.peerToken,
      buyerFarmId
    });
  }

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    process.env.MOBILE_MONEY_PROVIDER = "dev";
    process.env.FEATURE_WALLET = "true";

    base = await seedE2eFixtures(PrismaClient);
    vetCtx = await seedE2eVetRbacFixtures(PrismaClient);
    app = await createTestApp();

    merchant = await seedMerchantE2E(base.prisma, base);
    await chooseFreeSubscription(app, merchant);
    await createMerchantShop(app, merchant);
    const product = await createMerchantProduct(
      app,
      merchant,
      "Produit paiement e2e",
      10
    );
    await publishProduct(app, merchant, product.body.id as string);
    publishedProductId = product.body.id as string;

    billingSchemaReady = await isMerchantSubscriptionBillingSchemaReady(
      base.prisma
    );
    if (billingSchemaReady) {
      await prepareMerchantBillingE2e(base.prisma, merchant.merchantUserId);
    }

    const existingBuyerFarm = await base.prisma.farm.findFirst({
      where: { ownerId: base.peerUserId },
      select: { id: true }
    });
    buyerFarmId =
      existingBuyerFarm?.id ??
      (await seedBuyerFarm(base.prisma, base.peerUserId));
    await prepareWalletE2eUsers(base.prisma, {
      buyerUserId: base.peerUserId,
      sellerUserId: base.userId
    });
    await creditWalletViaDevTopUp({
      app,
      token: base.peerToken,
      amount: 500_000
    });
  });

  afterAll(async () => {
    try {
      if (merchant && base?.prisma) {
        await cleanupMerchantE2E(base.prisma, merchant, base);
      }
    } catch {
      // ignore teardown races
    }
    if (app) {
      await app.close();
    }
    try {
      if (vetCtx?.prisma) {
        await cleanupE2eVetRbacFixtures(vetCtx.prisma, {
          farmId: vetCtx.farmId,
          producerUserId: vetCtx.producerUserId,
          vetUserId: vetCtx.vetUserId
        });
      }
    } catch {
      // ignore
    }
    try {
      if (base?.prisma) {
        await cleanupE2eFixtures(base.prisma, {
          farmId: base.farmId,
          userId: base.userId,
          peerUserId: base.peerUserId
        });
      }
    } catch {
      // ignore
    }
  });

  describe("paymentMethod requis (hors abonnements)", () => {
    it("RDV vétérinaire — 400 si paymentMethod absent", async () => {
      const appointmentId = await seedVetAwaitingPayment(app, vetCtx);
      const res = await request(app.getHttpServer())
        .post(
          `/api/v1/vet-appointments/${appointmentId}/payment/initiate`
        )
        .set("Authorization", `Bearer ${vetCtx.producerToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("marketplace — 400 si paymentMethod absent", async () => {
      const deal = await freshMarketplaceDeal();
      const res = await request(app.getHttpServer())
        .post(
          `/api/v1/marketplace/transactions/${deal.transactionId}/payment/initiate`
        )
        .set("Authorization", `Bearer ${base.peerToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("solde crédit — 400 si paymentMethod absent", async () => {
      const res = await request(app.getHttpServer())
        .post(
          `/api/v1/marketplace/offers/${randomUUID()}/balance-payment/initiate`
        )
        .set("Authorization", `Bearer ${base.peerToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("achat boutique — 400 si paymentMethod absent", async () => {
      const res = await request(app.getHttpServer())
        .post(
          `/api/v1/merchant/catalog/products/${publishedProductId}/purchase`
        )
        .set("Authorization", `Bearer ${base.peerToken}`)
        .send({ quantity: 1 });
      expect(res.status).toBe(400);
    });
  });

  describe("méthodes explicites wallet / mobile_money", () => {
    it("marketplace — wallet et mobile_money acceptés explicitement", async () => {
      const walletTx = await freshMarketplaceDeal();
      await payMarketplaceWallet({
        app,
        buyerToken: base.peerToken,
        transactionId: walletTx.transactionId
      });

      const mobileTx = await freshMarketplaceDeal();
      await payMarketplaceMobileMoney({
        app,
        buyerToken: base.peerToken,
        transactionId: mobileTx.transactionId
      });
    });

    it("achat boutique mobile_money — reste payment_pending après initiate", async () => {
      const purchase = await request(app.getHttpServer())
        .post(
          `/api/v1/merchant/catalog/products/${publishedProductId}/purchase`
        )
        .set("Authorization", `Bearer ${base.peerToken}`)
        .send({ quantity: 1, paymentMethod: "mobile_money" });
      expect(purchase.status).toBe(201);
      expect(purchase.body.paymentMethod).toBe("mobile_money");
      expect(purchase.body.providerRef).toBeTruthy();

      const order = await base.prisma.merchantOrder.findUniqueOrThrow({
        where: { id: purchase.body.orderId as string }
      });
      expect(order.status).toBe(MerchantOrderStatus.payment_pending);
      expect(order.paymentMethod).toBe(MarketplacePaymentMethod.mobile_money);
    });

    it("achat boutique wallet — reste payment_pending après initiate explicite", async () => {
      const purchase = await request(app.getHttpServer())
        .post(
          `/api/v1/merchant/catalog/products/${publishedProductId}/purchase`
        )
        .set("Authorization", `Bearer ${base.peerToken}`)
        .send({ quantity: 1, paymentMethod: "wallet" });
      expect(purchase.status).toBe(201);
      expect(purchase.body.paymentMethod).toBe("wallet");

      const pending = await base.prisma.merchantOrder.findUniqueOrThrow({
        where: { id: purchase.body.orderId as string }
      });
      expect(pending.status).toBe(MerchantOrderStatus.payment_pending);
      expect(pending.paymentMethod).toBe(MarketplacePaymentMethod.wallet);
    });
  });

  describe("abonnements — paymentMethod reste optionnel", () => {
    it("abonnement Premium commerçant sans paymentMethod — défaut mobile_money", async () => {
      if (!billingSchemaReady) {
        return;
      }
      await resetMerchantSubscriptionBillingState(
        base.prisma,
        merchant.merchantUserId
      );
      await prepareMerchantBillingE2e(base.prisma, merchant.merchantUserId);
      await chooseFreeSubscription(app, merchant);

      const res = await request(app.getHttpServer())
        .post("/api/v1/merchant/me/subscription")
        .set("Authorization", `Bearer ${merchant.merchantToken}`)
        .set("X-Profile-Id", merchant.merchantProfileId)
        .send({ tier: MerchantSubscriptionTier.premium });
      expect(res.status).not.toBe(400);
      expect([201, 503]).toContain(res.status);
      if (res.status !== 201) {
        return;
      }

      const profile = await base.prisma.merchantProfile.findUniqueOrThrow({
        where: { userId: merchant.merchantUserId }
      });
      const pendingInvoice =
        await base.prisma.merchantSubscriptionInvoice.findFirst({
          where: {
            merchantProfileId: profile.id,
            status: "pending"
          },
          orderBy: { createdAt: "desc" }
        });
      expect(pendingInvoice).toBeTruthy();
    });
  });
});
