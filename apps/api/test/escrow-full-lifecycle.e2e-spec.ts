import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  MarketplaceFundMovementKind,
  MarketplacePaymentMethod,
  PrismaClient
} from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import {
  attachSuperAdminToUser,
  detachSuperAdmin
} from "./helpers/e2e-admin-seed";
import {
  cleanupE2eFixtures,
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
  creditWalletViaDevTopUp,
  payMarketplaceWallet,
  prepareWalletE2eUsers,
  purgeWalletE2eData
} from "./helpers/wallet-payout-e2e";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

/**
 * Réplique fidèle de settlementAmounts (buyerPaysCommission = true) — sert de
 * référence indépendante pour vérifier les montants au centime, sans importer
 * le code testé (le test croise ce que fait la prod, il ne s'auto-vérifie pas).
 */
function expectedSettlement(params: {
  blockedAmount: number;
  finalAmount: number;
  commissionRate: number;
  sellerCommissionRate: number;
}) {
  const commissionAmount = Math.round(
    params.finalAmount * params.commissionRate
  );
  const sellerCommissionAmount = Math.round(
    params.finalAmount * params.sellerCommissionRate
  );
  const totalCommissionAmount = commissionAmount + sellerCommissionAmount;
  const sellerReceivedAmount = Math.max(
    0,
    params.finalAmount - sellerCommissionAmount
  );
  const buyerTotalOwed = params.finalAmount + commissionAmount;
  const delta = params.blockedAmount - buyerTotalOwed;
  return {
    commissionAmount,
    sellerCommissionAmount,
    totalCommissionAmount,
    sellerReceivedAmount,
    buyerRefundAmount: delta > 0 ? delta : 0,
    buyerAdditionalCharge: delta < 0 ? Math.abs(delta) : 0
  };
}

describeOrSkip("Escrow porc — cycle financier complet (e2e P-44)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let buyerFarmId: string;
  let superAdminId: string;

  const TOP_UP = 300_000;

  async function walletBalance(token: string): Promise<number> {
    const res = await request(app.getHttpServer())
      .get("/api/v1/users/me/wallet")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    return Number(res.body.balance ?? 0);
  }

  async function pickupAndDeclareBuyerWeight(
    ctxDeal: MarketplaceDeliveryCtx,
    buyerWeightKg: number
  ): Promise<void> {
    const pickup = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/transactions/${ctxDeal.transactionId}/pickup`)
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        pickupDate: new Date().toISOString().slice(0, 10),
        pickupLocation: "Ferme E2E"
      });
    expect(pickup.status).toBe(201);

    const pickupConfirm = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${ctxDeal.transactionId}/pickup/confirm`
      )
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(pickupConfirm.status).toBe(201);

    const declare = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${ctxDeal.transactionId}/weight/declare`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        realWeightKg: buyerWeightKg,
        animalWeights: [
          { animalId: ctxDeal.animalId, weightKg: buyerWeightKg }
        ]
      });
    expect(declare.status).toBe(201);
    expect(declare.body.status).toBe("WEIGHT_DECLARED");
  }

  async function shipAndConfirmReceipt(
    ctxDeal: MarketplaceDeliveryCtx
  ): Promise<void> {
    const ship = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${ctxDeal.transactionId}/confirm-shipment`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ shippedAt: new Date().toISOString().slice(0, 10), method: "handover" });
    expect(ship.status).toBe(201);
    expect(ship.body.status).toBe("SELLER_SHIPPED");

    const receipt = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${ctxDeal.transactionId}/confirm-receipt`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        receivedAt: new Date().toISOString().slice(0, 10),
        condition: "conform",
        receivedAnimalIds: [ctxDeal.animalId]
      });
    expect(receipt.status).toBe(201);
    expect(receipt.body.status).toBe("TRANSACTION_CLOSED");
  }

  /** Paie en portefeuille et vérifie que le montant séquestré = blockedAmount. */
  async function payAndAssertEscrowHold(
    ctxDeal: MarketplaceDeliveryCtx
  ): Promise<{ blockedAmount: number }> {
    const tx = await ctx.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: ctxDeal.transactionId },
      select: { blockedAmount: true }
    });
    const blockedAmount = Number(tx.blockedAmount);

    await creditWalletViaDevTopUp({ app, token: ctx.peerToken, amount: TOP_UP });
    const buyerBefore = await walletBalance(ctx.peerToken);

    await payMarketplaceWallet({
      app,
      buyerToken: ctx.peerToken,
      transactionId: ctxDeal.transactionId
    });

    const buyerAfter = await walletBalance(ctx.peerToken);
    // Séquestre : le portefeuille acheteur est débité exactement du montant bloqué.
    expect(buyerBefore - buyerAfter).toBe(blockedAmount);
    return { blockedAmount };
  }

  async function assertSettlement(
    ctxDeal: MarketplaceDeliveryCtx,
    expectedFinalAmount: number,
    sellerBalanceBeforeSettle: number,
    buyerBalanceAfterHold: number
  ): Promise<void> {
    const tx = await ctx.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: ctxDeal.transactionId }
    });
    expect(tx.status).toBe("TRANSACTION_CLOSED");
    expect(tx.paymentMethod).toBe(MarketplacePaymentMethod.wallet);

    const expected = expectedSettlement({
      blockedAmount: Number(tx.blockedAmount),
      finalAmount: expectedFinalAmount,
      commissionRate: Number(tx.commissionRate),
      sellerCommissionRate: Number(tx.sellerCommissionRate ?? 0)
    });
    // Aucune de nos variantes ne déclenche de complément (poids retenu ≤ estimé).
    expect(expected.buyerAdditionalCharge).toBe(0);

    // Montant recalculé et persisté au centime.
    expect(Number(tx.finalAmount)).toBe(expectedFinalAmount);
    expect(Number(tx.sellerReceivedAmount)).toBe(expected.sellerReceivedAmount);
    expect(Number(tx.buyerRefundAmount)).toBe(expected.buyerRefundAmount);
    expect(Number(tx.commissionAmount)).toBe(expected.commissionAmount);

    // Portefeuille vendeur crédité exactement du net reçu.
    const sellerAfter = await walletBalance(ctx.token);
    expect(sellerAfter - sellerBalanceBeforeSettle).toBe(
      expected.sellerReceivedAmount
    );

    // Portefeuille acheteur : seul le remboursement du surplus séquestré le crédite.
    const buyerAfter = await walletBalance(ctx.peerToken);
    expect(buyerAfter - buyerBalanceAfterHold).toBe(expected.buyerRefundAmount);

    // Commission plateforme au règlement.
    const revenue = await ctx.prisma.platformRevenue.findFirstOrThrow({
      where: { transactionId: ctxDeal.transactionId }
    });
    expect(Number(revenue.commissionAmount)).toBe(expected.totalCommissionAmount);

    const commissionMv = await ctx.prisma.marketplaceFundMovement.findFirstOrThrow(
      {
        where: {
          transactionId: ctxDeal.transactionId,
          kind: MarketplaceFundMovementKind.COMMISSION
        }
      }
    );
    expect(Number(commissionMv.amount)).toBe(expected.totalCommissionAmount);

    const releaseMv = await ctx.prisma.marketplaceFundMovement.findFirstOrThrow({
      where: {
        transactionId: ctxDeal.transactionId,
        kind: MarketplaceFundMovementKind.RELEASE_TO_SELLER
      }
    });
    expect(releaseMv.providerRef).toMatch(/^wallet:/);
  }

  async function freshDeal(): Promise<MarketplaceDeliveryCtx> {
    await cleanupBuyerMarketplaceState(ctx.prisma, [ctx.userId, ctx.peerUserId]);
    return setupMarketplaceDeliveryListing({
      app,
      prisma: ctx.prisma,
      sellerToken: ctx.token,
      sellerProfileId: ctx.producerProfileId,
      sellerFarmId: ctx.farmId,
      buyerToken: ctx.peerToken,
      buyerFarmId
    });
  }

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    process.env.MOBILE_MONEY_PROVIDER = "dev";
    process.env.FEATURE_WALLET = "true";
    ctx = await seedE2eFixtures(PrismaClient);
    buyerFarmId = await seedBuyerFarm(ctx.prisma, ctx.peerUserId);
    await prepareWalletE2eUsers(ctx.prisma, {
      buyerUserId: ctx.peerUserId,
      sellerUserId: ctx.userId
    });
    const admin = await attachSuperAdminToUser(ctx.prisma, ctx.userId);
    superAdminId = admin.superAdminId;
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      await purgeWalletE2eData(ctx.prisma, [ctx.userId, ctx.peerUserId]);
      await cleanupBuyerMarketplaceState(ctx.prisma, [ctx.userId, ctx.peerUserId]);
      await ctx.prisma.farm.deleteMany({ where: { ownerId: ctx.peerUserId } });
      if (superAdminId) {
        await detachSuperAdmin(ctx.prisma, superAdminId);
      }
      await cleanupE2eFixtures(ctx.prisma, {
        farmId: ctx.farmId,
        userId: ctx.userId,
        peerUserId: ctx.peerUserId
      });
    }
  });

  it("(a) happy path — poids identiques : vendeur payé, aucune remise, commission prélevée", async () => {
    const deal = await freshDeal();
    await payAndAssertEscrowHold(deal);

    const buyerAfterHold = await walletBalance(ctx.peerToken);
    const sellerBefore = await walletBalance(ctx.token);

    await pickupAndDeclareBuyerWeight(deal, 25);
    // Le vendeur accepte le poids de l'acheteur (pas de contre-déclaration).
    const validate = await request(app.getHttpServer())
      .post(`/api/v1/marketplace/transactions/${deal.transactionId}/weight/validate`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(validate.status).toBe(201);

    await shipAndConfirmReceipt(deal);

    // finalAmount = 3000 XOF/kg × 25 kg = 75 000.
    await assertSettlement(deal, 3_000 * 25, sellerBefore, buyerAfterHold);
  });

  it("(b) écart sous tolérance — validation auto au poids MOYEN, montant recalculé", async () => {
    const deal = await freshDeal();
    await payAndAssertEscrowHold(deal);

    const buyerAfterHold = await walletBalance(ctx.peerToken);
    const sellerBefore = await walletBalance(ctx.token);

    // Acheteur 25 kg, vendeur 24,5 kg : écart 0,5 kg ≤ tolérance (max(3 %×25 ; 1 kg) = 1 kg).
    await pickupAndDeclareBuyerWeight(deal, 25);
    const sellerDeclare = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${deal.transactionId}/weight/seller-declare`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ sellerDeclaredWeightKg: 24.5 });
    expect(sellerDeclare.status).toBe(201);

    // Sous tolérance → poids retenu = moyenne (25 + 24,5) / 2 = 24,75 kg, validation directe.
    const tx = await ctx.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: deal.transactionId }
    });
    expect(tx.status).toBe("WEIGHT_VALIDATED");
    expect(Number(tx.realWeightKg)).toBe(24.75);

    await shipAndConfirmReceipt(deal);

    // finalAmount recalculé = 3000 × 24,75 = 74 250 (< happy path 75 000) → remise acheteur.
    await assertSettlement(deal, 3_000 * 24.75, sellerBefore, buyerAfterHold);
  });

  it("(c) écart au-dessus — litige poids, arbitrage admin, règlement au poids arbitré", async () => {
    const deal = await freshDeal();
    await payAndAssertEscrowHold(deal);

    const buyerAfterHold = await walletBalance(ctx.peerToken);
    const sellerBefore = await walletBalance(ctx.token);

    // Acheteur 25 kg, vendeur 21 kg : écart 4 kg > tolérance → contre-déclaration.
    await pickupAndDeclareBuyerWeight(deal, 25);
    const sellerDeclare = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${deal.transactionId}/weight/seller-declare`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ sellerDeclaredWeightKg: 21 });
    expect(sellerDeclare.status).toBe(201);
    expect(sellerDeclare.body.status).toBe("WEIGHT_COUNTER_DECLARED");

    const arbitrationReq = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${deal.transactionId}/weight/request-arbitration`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({});
    expect(arbitrationReq.status).toBe(201);

    const disputed = await ctx.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: deal.transactionId }
    });
    expect(disputed.status).toBe("WEIGHT_DISPUTED");

    // Arbitrage admin à 23 kg (≤ estimé 25 → remboursement, pas de complément).
    const arbitrate = await request(app.getHttpServer())
      .post(
        `/api/v1/admin/marketplace/transactions/${deal.transactionId}/arbitrate`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ arbitrationWeightKg: 23 });
    expect(arbitrate.status).toBe(201);

    const arbitrated = await ctx.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: deal.transactionId }
    });
    expect(arbitrated.status).toBe("WEIGHT_VALIDATED");
    expect(Number(arbitrated.arbitrationWeightKg)).toBe(23);

    await shipAndConfirmReceipt(deal);

    // finalAmount = 3000 × 23 (poids arbitré prioritaire) = 69 000.
    await assertSettlement(deal, 3_000 * 23, sellerBefore, buyerAfterHold);
  });
});
