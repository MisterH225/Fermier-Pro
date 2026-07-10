import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  MarketplaceTransactionStatus,
  PrismaClient
} from "@prisma/client";
import request from "supertest";
import {
  createTestAppWithGeniusPayMock,
  postGeniusPayWebhook
} from "./helpers/create-test-app-with-geniuspay-mock";
import {
  cleanupE2eFixtures,
  purgeMarketplaceForUsers,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";
import {
  seedBuyerFarm,
  setupMarketplaceDeliveryListing,
  type MarketplaceDeliveryCtx
} from "./helpers/marketplace-delivery-e2e";
import {
  cleanupBuyerMarketplaceState,
  prepareWalletE2eUsers
} from "./helpers/wallet-payout-e2e";
import type { GeniusPayE2eMock } from "./mocks/geniuspay-e2e.mock";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

jest.setTimeout(600_000);

describeOrSkip("Marketplace escrow + wallet — GeniusPay webhook (e2e)", () => {
  let app: NestExpressApplication;
  let base: E2ESeedResult;
  let geniusPay: GeniusPayE2eMock;
  let buyerFarmId: string;

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

  async function initiateMarketplaceMobileMoney(
    transactionId: string
  ): Promise<{ providerRef: string; amount: number }> {
    const init = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${transactionId}/payment/initiate`
      )
      .set("Authorization", `Bearer ${base.peerToken}`)
      .send({ paymentMethod: "mobile_money" });
    expect(init.status).toBe(201);
    return {
      providerRef: init.body.providerRef as string,
      amount: Number(init.body.amount)
    };
  }

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    process.env.MOBILE_MONEY_PROVIDER = "geniuspay";
    process.env.FEATURE_WALLET = "true";
    process.env.GENIUSPAY_WEBHOOK_SECRET = "whsec_e2e_marketplace_gp";

    base = await seedE2eFixtures(PrismaClient);
    buyerFarmId = await seedBuyerFarm(base.prisma, base.peerUserId);
    await prepareWalletE2eUsers(base.prisma, {
      buyerUserId: base.peerUserId,
      sellerUserId: base.userId
    });

    const created = await createTestAppWithGeniusPayMock();
    app = created.app;
    geniusPay = created.geniusPay;
  });

  beforeEach(() => {
    geniusPay.reset();
  });

  afterAll(async () => {
    await app?.close();
    await cleanupE2eFixtures(base.prisma, {
      farmId: base.farmId,
      userId: base.userId,
      peerUserId: base.peerUserId
    });
  });

  it("webhook payment.success marketplace_escrow → PAYMENT_HELD sans GET", async () => {
    const deal = await freshMarketplaceDeal();
    const { providerRef, amount } = await initiateMarketplaceMobileMoney(
      deal.transactionId
    );

    const webhook = await postGeniusPayWebhook(app, {
      id: "evt-escrow-1",
      event: "payment.success",
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        reference: providerRef,
        amount,
        currency: "XOF",
        metadata: {
          kind: "marketplace_escrow",
          user_id: base.peerUserId,
          transaction_id: deal.transactionId,
          amount: String(amount)
        }
      }
    });
    expect(webhook.status).toBe(201);
    expect(webhook.body.ok).toBe(true);

    const tx = await base.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: deal.transactionId }
    });
    expect(tx.status).toBe(MarketplaceTransactionStatus.PAYMENT_HELD);
    expect(tx.paymentProviderRef).toBe(providerRef);
  });

  it("webhook avec référence différente + transaction_id → met à jour providerRef", async () => {
    const deal = await freshMarketplaceDeal();
    const { providerRef, amount } = await initiateMarketplaceMobileMoney(
      deal.transactionId
    );
    const paidRef = `${providerRef}-paid`;

    const webhook = await postGeniusPayWebhook(app, {
      id: "evt-escrow-2",
      event: "payment.success",
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        reference: paidRef,
        amount,
        currency: "XOF",
        metadata: {
          kind: "marketplace_escrow",
          user_id: base.peerUserId,
          transaction_id: deal.transactionId
        }
      }
    });
    expect(webhook.status).toBe(201);

    const tx = await base.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: deal.transactionId }
    });
    expect(tx.status).toBe(MarketplaceTransactionStatus.PAYMENT_HELD);
    expect(tx.paymentProviderRef).toBe(paidRef);
  });

  it("relance initiate sur paiement completed → alreadyConfirmed sans nouvelle ref", async () => {
    const deal = await freshMarketplaceDeal();
    const { providerRef } = await initiateMarketplaceMobileMoney(deal.transactionId);
    geniusPay.markPaymentCompleted(providerRef);

    const relance = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${deal.transactionId}/payment/initiate`
      )
      .set("Authorization", `Bearer ${base.peerToken}`)
      .send({ paymentMethod: "mobile_money" });
    expect(relance.status).toBe(201);
    expect(relance.body.alreadyConfirmed).toBe(true);
    expect(relance.body.providerRef).toBe(providerRef);

    const tx = await base.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: deal.transactionId }
    });
    expect(tx.status).toBe(MarketplaceTransactionStatus.PAYMENT_HELD);
    expect(tx.paymentProviderRef).toBe(providerRef);
  });

  it("payment.success non résolu → 404 (pas de ACK silencieux)", async () => {
    const webhook = await postGeniusPayWebhook(app, {
      id: "evt-escrow-orphan",
      event: "payment.success",
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        reference: "orphan-escrow-ref",
        amount: 75_000,
        currency: "XOF",
        metadata: { user_id: base.peerUserId }
      }
    });
    expect(webhook.status).toBe(404);
  });

  it("payment.failed marketplace_escrow → PAYMENT_FAILED", async () => {
    const deal = await freshMarketplaceDeal();
    const { providerRef } = await initiateMarketplaceMobileMoney(deal.transactionId);

    const webhook = await postGeniusPayWebhook(app, {
      id: "evt-escrow-fail",
      event: "payment.failed",
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        reference: providerRef,
        amount: 75_000,
        currency: "XOF",
        metadata: {
          kind: "marketplace_escrow",
          user_id: base.peerUserId,
          transaction_id: deal.transactionId
        }
      }
    });
    expect(webhook.status).toBe(201);

    const tx = await base.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: deal.transactionId }
    });
    expect(tx.status).toBe(MarketplaceTransactionStatus.PAYMENT_FAILED);
  });

  it("webhook wallet_topup → crédit sans GET /payments", async () => {
    const topUpAmount = 25_000;
    const init = await request(app.getHttpServer())
      .post("/api/v1/users/me/wallet/top-up/initiate")
      .set("Authorization", `Bearer ${base.peerToken}`)
      .send({ amount: topUpAmount });
    expect(init.status).toBe(201);
    const providerRef = init.body.providerRef as string;

    const webhook = await postGeniusPayWebhook(app, {
      id: "evt-topup-1",
      event: "payment.success",
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        reference: providerRef,
        amount: topUpAmount,
        currency: "XOF",
        metadata: {
          kind: "wallet_topup",
          user_id: base.peerUserId,
          amount: String(topUpAmount)
        }
      }
    });
    expect(webhook.status).toBe(201);
    expect(webhook.body.ok).toBe(true);

    const summary = await request(app.getHttpServer())
      .get("/api/v1/users/me/wallet")
      .set("Authorization", `Bearer ${base.peerToken}`);
    expect(summary.status).toBe(200);
    expect(Number(summary.body.balance)).toBeGreaterThan(0);

    const entry = await base.prisma.userWalletEntry.findUnique({
      where: { idempotencyKey: `topup:${providerRef}` }
    });
    expect(entry).toBeTruthy();
  });
});
