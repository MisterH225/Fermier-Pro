import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  MarketplaceFundMovementKind,
  MarketplacePaymentMethod,
  PrismaClient,
  UserWalletEntryKind
} from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import {
  cleanupE2eFixtures,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";
import { seedBuyerFarm } from "./helpers/marketplace-delivery-e2e";
import {
  assertFundMovement,
  assertWithdrawalCompleted,
  cleanupBuyerMarketplaceState,
  creditWalletViaDevTopUp,
  prepareWalletE2eUsers,
  purgeWalletE2eData,
  runMarketplaceSettlementHappyPath,
  setupMarketplaceListingOnly,
  setupPaidMarketplaceForPayout,
  withdrawWalletViaDevGateway
} from "./helpers/wallet-payout-e2e";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

async function isWalletE2eSchemaReady(prisma: PrismaClient): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'UserWalletEntry'
      AND column_name = 'merchantOrderId'
  `;
  return rows.length > 0;
}

describeOrSkip("Wallet, versement vendeur et remboursement (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let buyerFarmId: string;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    process.env.MOBILE_MONEY_PROVIDER = "dev";
    process.env.FEATURE_WALLET = "true";
    ctx = await seedE2eFixtures(PrismaClient);
    const schemaReady = await isWalletE2eSchemaReady(ctx.prisma);
    if (!schemaReady) {
      throw new Error(
        "Schéma DB incomplet pour les e2e wallet/payout. Exécutez: npm run prisma:push --workspace @fermier/api"
      );
    }
    buyerFarmId = await seedBuyerFarm(ctx.prisma, ctx.peerUserId);
    await prepareWalletE2eUsers(ctx.prisma, {
      buyerUserId: ctx.peerUserId,
      sellerUserId: ctx.userId
    });
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupBuyerMarketplaceState(ctx.prisma, ctx.peerUserId);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      await purgeWalletE2eData(ctx.prisma, [ctx.userId, ctx.peerUserId]);
      await cleanupBuyerMarketplaceState(ctx.prisma, ctx.peerUserId);
      await ctx.prisma.farm.deleteMany({ where: { ownerId: ctx.peerUserId } });
      await cleanupE2eFixtures(ctx.prisma, {
        farmId: ctx.farmId,
        userId: ctx.userId,
        peerUserId: ctx.peerUserId
      });
    }
  });

  it("retrait portefeuille : recharge → initiation → confirmation (gateway dev)", async () => {
    const balanceAfterTopUp = await creditWalletViaDevTopUp({
      app,
      token: ctx.peerToken,
      amount: 20_000
    });
    expect(balanceAfterTopUp).toBeGreaterThanOrEqual(19_000);

    const beforeWithdraw = await request(app.getHttpServer())
      .get("/api/v1/users/me/wallet")
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(beforeWithdraw.status).toBe(200);

    const { providerRef, balance } = await withdrawWalletViaDevGateway({
      app,
      token: ctx.peerToken,
      amount: 5_000,
      clientRequestId: `e2e-withdraw-wallet-${Date.now()}`
    });
    expect(providerRef).toMatch(/^dev-withdraw-/);
    expect(balance).toBeLessThan(Number(beforeWithdraw.body.balance));

    await assertWithdrawalCompleted(ctx.prisma, ctx.peerUserId, providerRef);

    const debitEntry = await ctx.prisma.userWalletEntry.findFirst({
      where: {
        wallet: { userId: ctx.peerUserId },
        kind: UserWalletEntryKind.debit_withdraw,
        providerRef
      }
    });
    expect(debitEntry).toBeTruthy();
  });

  it("versement vendeur — paiement wallet : crédit portefeuille vendeur à la clôture", async () => {
    const listing = await setupMarketplaceListingOnly({
      app,
      prisma: ctx.prisma,
      sellerToken: ctx.token,
      sellerProfileId: ctx.producerProfileId,
      sellerFarmId: ctx.farmId,
      buyerToken: ctx.peerToken,
      buyerFarmId
    });

    const sellerWalletBefore = await request(app.getHttpServer())
      .get("/api/v1/users/me/wallet")
      .set("Authorization", `Bearer ${ctx.token}`);
    const sellerBalanceBefore = Number(sellerWalletBefore.body.balance ?? 0);

    await runMarketplaceSettlementHappyPath({
      app,
      sellerToken: ctx.token,
      buyerToken: ctx.peerToken,
      ctx: listing,
      payment: "wallet"
    });

    const tx = await ctx.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: listing.transactionId }
    });
    expect(tx.paymentMethod).toBe(MarketplacePaymentMethod.wallet);
    expect(tx.status).toBe("TRANSACTION_CLOSED");
    expect(Number(tx.sellerReceivedAmount ?? 0)).toBeGreaterThan(0);

    await assertFundMovement(
      ctx.prisma,
      listing.transactionId,
      MarketplaceFundMovementKind.RELEASE_TO_SELLER,
      /^wallet:/
    );

    const sellerWalletAfter = await request(app.getHttpServer())
      .get("/api/v1/users/me/wallet")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(Number(sellerWalletAfter.body.balance)).toBeGreaterThan(
      sellerBalanceBefore
    );
  });

  it("versement vendeur — paiement mobile money : mouvement RELEASE via gateway dev", async () => {
    const listing = await setupMarketplaceListingOnly({
      app,
      prisma: ctx.prisma,
      sellerToken: ctx.token,
      sellerProfileId: ctx.producerProfileId,
      sellerFarmId: ctx.farmId,
      buyerToken: ctx.peerToken,
      buyerFarmId
    });

    await runMarketplaceSettlementHappyPath({
      app,
      sellerToken: ctx.token,
      buyerToken: ctx.peerToken,
      ctx: listing,
      payment: "mobile_money"
    });

    const tx = await ctx.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: listing.transactionId }
    });
    expect(tx.paymentMethod).toBe(MarketplacePaymentMethod.mobile_money);

    await assertFundMovement(
      ctx.prisma,
      listing.transactionId,
      MarketplaceFundMovementKind.RELEASE_TO_SELLER,
      /^dev-release-/
    );
  });

  it("remboursement acheteur — litige résolu en faveur de l'acheteur (mobile money)", async () => {
    const listing = await setupPaidMarketplaceForPayout({
      app,
      prisma: ctx.prisma,
      sellerToken: ctx.token,
      sellerProfileId: ctx.producerProfileId,
      sellerFarmId: ctx.farmId,
      buyerToken: ctx.peerToken,
      buyerUserId: ctx.peerUserId,
      buyerFarmId,
      payment: "mobile_money"
    });

    const openDispute = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${listing.transactionId}/delivery-dispute`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        disputeType: "Non-conformité",
        description: "E2E remboursement acheteur"
      });
    expect(openDispute.status).toBe(201);

    const dispute = await ctx.prisma.marketplaceDeliveryDispute.findFirstOrThrow({
      where: { transactionId: listing.transactionId }
    });

    await ctx.prisma.superAdmin.upsert({
      where: { userId: ctx.userId },
      create: { userId: ctx.userId },
      update: {}
    });

    const resolve = await request(app.getHttpServer())
      .patch(`/api/v1/marketplace/disputes/${dispute.id}/resolve`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ outcome: "resolved_buyer", notes: "E2E remboursement total" });
    expect(resolve.status).toBe(200);

    await assertFundMovement(
      ctx.prisma,
      listing.transactionId,
      MarketplaceFundMovementKind.REFUND_BUYER,
      /^dev-refund-/
    );

    const tx = await ctx.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: listing.transactionId }
    });
    expect(tx.status).toBe("CANCELLED_BY_SELLER");
    expect(Number(tx.buyerRefundAmount ?? 0)).toBeGreaterThan(0);
  });

  it("remboursement acheteur — paiement wallet : crédit portefeuille acheteur", async () => {
    const listing = await setupPaidMarketplaceForPayout({
      app,
      prisma: ctx.prisma,
      sellerToken: ctx.token,
      sellerProfileId: ctx.producerProfileId,
      sellerFarmId: ctx.farmId,
      buyerToken: ctx.peerToken,
      buyerUserId: ctx.peerUserId,
      buyerFarmId,
      payment: "wallet"
    });

    const buyerWalletBefore = await request(app.getHttpServer())
      .get("/api/v1/users/me/wallet")
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    const balanceBefore = Number(buyerWalletBefore.body.balance ?? 0);

    const openDispute = await request(app.getHttpServer())
      .post(
        `/api/v1/marketplace/transactions/${listing.transactionId}/delivery-dispute`
      )
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        disputeType: "Annulation",
        description: "E2E remboursement wallet"
      });
    expect(openDispute.status).toBe(201);

    const dispute = await ctx.prisma.marketplaceDeliveryDispute.findFirstOrThrow({
      where: { transactionId: listing.transactionId }
    });

    await ctx.prisma.superAdmin.upsert({
      where: { userId: ctx.userId },
      create: { userId: ctx.userId },
      update: {}
    });

    const resolve = await request(app.getHttpServer())
      .patch(`/api/v1/marketplace/disputes/${dispute.id}/resolve`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ outcome: "resolved_buyer", notes: "E2E remboursement wallet" });
    expect(resolve.status).toBe(200);

    await assertFundMovement(
      ctx.prisma,
      listing.transactionId,
      MarketplaceFundMovementKind.REFUND_BUYER,
      /^wallet:/
    );

    const buyerWalletAfter = await request(app.getHttpServer())
      .get("/api/v1/users/me/wallet")
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(Number(buyerWalletAfter.body.balance)).toBeGreaterThan(balanceBefore);
  });
});
