import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  MerchantSubscriptionInvoiceStatus,
  MerchantSubscriptionStatus,
  MerchantSubscriptionTier,
  PrismaClient
} from "@prisma/client";
import { MerchantSubscriptionBillingService } from "../src/merchant-shop/merchant-subscription-billing.service";
import {
  addMonthsUtc,
  startOfUtcDay
} from "../src/merchant-shop/merchant-subscription.constants";
import { createTestAppWithGeniusPayMock } from "./helpers/create-test-app-with-geniuspay-mock";
import {
  cleanupE2eFixtures,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";
import {
  cleanupMerchantE2E,
  seedMerchantE2E,
  type MerchantE2ECtx
} from "./helpers/merchant-shop-e2e";
import {
  choosePremiumMobileMoney,
  choosePremiumWallet,
  confirmMerchantSubscription,
  creditMerchantWallet,
  getMerchantMe,
  isMerchantSubscriptionBillingSchemaReady,
  prepareMerchantBillingE2e,
  renewMerchantSubscription,
  resetMerchantSubscriptionBillingState,
  seedActivePremiumDueToday,
  seedPastDuePremiumGraceExpired
} from "./helpers/merchant-subscription-billing-e2e";
import type { GeniusPayE2eMock } from "./mocks/geniuspay-e2e.mock";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Abonnement Premium commerçant — facturation (e2e)", () => {
  let app: NestExpressApplication;
  let base: E2ESeedResult;
  let merchant: MerchantE2ECtx;
  let geniusPay: GeniusPayE2eMock;
  let billing: MerchantSubscriptionBillingService;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    process.env.MOBILE_MONEY_PROVIDER = "dev";
    process.env.FEATURE_WALLET = "true";
    process.env.MERCHANT_SUBSCRIPTION_SMS_ENABLED = "false";

    base = await seedE2eFixtures(PrismaClient);
    const schemaReady = await isMerchantSubscriptionBillingSchemaReady(
      base.prisma
    );
    if (!schemaReady) {
      throw new Error(
        "Schéma DB incomplet pour les e2e abonnement commerçant. Exécutez: npm run prisma:push --workspace @fermier/api"
      );
    }

    const created = await createTestAppWithGeniusPayMock();
    app = created.app;
    geniusPay = created.geniusPay;
    billing = app.get(MerchantSubscriptionBillingService);

    merchant = await seedMerchantE2E(base.prisma, base);
    await prepareMerchantBillingE2e(base.prisma, merchant.merchantUserId);
  });

  beforeEach(async () => {
    geniusPay.reset();
    await resetMerchantSubscriptionBillingState(
      base.prisma,
      merchant.merchantUserId
    );
  });

  afterAll(async () => {
    if (merchant) {
      await cleanupMerchantE2E(base.prisma, merchant, base);
    }
    if (app) {
      await app.close();
    }
    if (base?.prisma) {
      await cleanupE2eFixtures(base.prisma, {
        farmId: base.farmId,
        userId: base.userId,
        peerUserId: base.peerUserId
      });
    }
  });

  it("souscription Premium via portefeuille → profil actif + prochaine échéance", async () => {
    await creditMerchantWallet(app, merchant.merchantToken, 20_000);

    const choose = await choosePremiumWallet(app, merchant);
    expect(choose.status).toBe(201);

    const me = await getMerchantMe(app, merchant);
    expect(me.status).toBe(200);
    expect(me.body.subscriptionTier).toBe(MerchantSubscriptionTier.premium);
    expect(me.body.subscriptionStatus).toBe(MerchantSubscriptionStatus.active);
    expect(me.body.nextBillingAt).toBeTruthy();
    expect(me.body.pendingRenewal).toBeNull();
    expect(me.body.pendingSubscription).toBeNull();

    const profile = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });
    const invoice = await base.prisma.merchantSubscriptionInvoice.findFirst({
      where: {
        merchantProfileId: profile.id,
        status: MerchantSubscriptionInvoiceStatus.paid
      }
    });
    expect(invoice).toBeTruthy();
  });

  it("souscription Premium mobile money → initiation GeniusPay → confirmation HTTP", async () => {
    const choose = await choosePremiumMobileMoney(app, merchant);
    expect(choose.status).toBe(201);
    expect(choose.body.pending).toBe(true);
    expect(choose.body.providerRef).toMatch(/^e2e-gp-/);
    expect(choose.body.paymentUrl).toContain("https://e2e.fermier.test/pay/");

    const mePending = await getMerchantMe(app, merchant);
    expect(mePending.status).toBe(200);
    expect(mePending.body.subscriptionTier).toBeNull();
    expect(mePending.body.pendingSubscription).toMatchObject({
      providerRef: choose.body.providerRef,
      paymentUrl: choose.body.paymentUrl,
      amount: expect.any(Number)
    });
    expect(mePending.body.pendingRenewal).toBeNull();

    geniusPay.markPaymentCompleted(choose.body.providerRef);

    const confirm = await confirmMerchantSubscription(
      app,
      merchant,
      choose.body.providerRef
    );
    expect(confirm.status).toBe(201);
    expect(confirm.body.subscriptionTier).toBe(MerchantSubscriptionTier.premium);
    expect(confirm.body.subscriptionStatus).toBe(MerchantSubscriptionStatus.active);
    expect(confirm.body.pendingSubscription).toBeNull();
  });

  it("cron J0 : renouvellement automatique via portefeuille si solde suffisant", async () => {
    const { billingDay } = await seedActivePremiumDueToday(
      base.prisma,
      merchant.merchantUserId,
      { walletBalance: 20_000 }
    );
    const before = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });

    await billing.runDailyBillingCycle();

    const after = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });
    expect(after.subscriptionTier).toBe(MerchantSubscriptionTier.premium);
    expect(after.subscriptionStatus).toBe(MerchantSubscriptionStatus.active);
    expect(after.nextBillingAt!.getTime()).toBeGreaterThan(
      before.nextBillingAt!.getTime()
    );

    const paidInvoice = await base.prisma.merchantSubscriptionInvoice.findFirst({
      where: {
        merchantProfileId: after.id,
        billingPeriodStart: billingDay,
        status: MerchantSubscriptionInvoiceStatus.paid
      }
    });
    expect(paidInvoice).toBeTruthy();
  });

  it("cron J0 sans solde → past_due, facture en attente et pendingRenewal exposé", async () => {
    await seedActivePremiumDueToday(base.prisma, merchant.merchantUserId, {
      walletBalance: 0
    });

    await billing.runDailyBillingCycle();

    const profile = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });
    expect(profile.subscriptionStatus).toBe(MerchantSubscriptionStatus.past_due);
    expect(profile.graceEndsAt).toBeTruthy();

    const pending = await base.prisma.merchantSubscriptionInvoice.findFirst({
      where: {
        merchantProfileId: profile.id,
        status: MerchantSubscriptionInvoiceStatus.pending
      }
    });
    expect(pending).toBeTruthy();
    expect(pending!.paymentUrl).toContain("https://e2e.fermier.test/pay/");

    const me = await getMerchantMe(app, merchant);
    expect(me.body.pendingRenewal).toMatchObject({
      invoiceId: pending!.id,
      amount: 5000,
      paymentUrl: pending!.paymentUrl
    });
  });

  it("POST renew + confirm → réactivation après impayé", async () => {
    await seedActivePremiumDueToday(base.prisma, merchant.merchantUserId, {
      walletBalance: 0
    });
    await billing.runDailyBillingCycle();

    const renew = await renewMerchantSubscription(app, merchant);
    expect(renew.status).toBe(201);
    expect(renew.body.pending).toBe(true);
    expect(renew.body.providerRef).toBeTruthy();

    geniusPay.markPaymentCompleted(renew.body.providerRef);

    const confirm = await confirmMerchantSubscription(
      app,
      merchant,
      renew.body.providerRef
    );
    expect(confirm.status).toBe(201);
    expect(confirm.body.subscriptionStatus).toBe(MerchantSubscriptionStatus.active);
    expect(confirm.body.pendingRenewal).toBeNull();
  });

  it("fin de période de grâce → downgrade automatique vers Free", async () => {
    await seedPastDuePremiumGraceExpired(
      base.prisma,
      merchant.merchantUserId
    );

    await billing.runDailyBillingCycle();

    const profile = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });
    expect(profile.subscriptionTier).toBe(MerchantSubscriptionTier.free);
    expect(profile.subscriptionStatus).toBeNull();
    expect(profile.graceEndsAt).toBeNull();

    const expiredInvoice = await base.prisma.merchantSubscriptionInvoice.findFirst({
      where: {
        merchantProfileId: profile.id,
        status: MerchantSubscriptionInvoiceStatus.expired
      }
    });
    expect(expiredInvoice).toBeTruthy();
  });

  it("rappel J-3 : billingReminderKey enregistré sans renvoyer le SMS", async () => {
    const today = startOfUtcDay(new Date());
    const dueIn3Days = addMonthsUtc(today, 0);
    dueIn3Days.setUTCDate(dueIn3Days.getUTCDate() + 3);

    const profile = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });
    await base.prisma.merchantProfile.update({
      where: { id: profile.id },
      data: {
        subscriptionTier: MerchantSubscriptionTier.premium,
        subscriptionStatus: MerchantSubscriptionStatus.active,
        nextBillingAt: dueIn3Days,
        billingReminderKey: null
      }
    });

    await billing.runDailyBillingCycle();

    const after = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { id: profile.id }
    });
    expect(after.billingReminderKey).toMatch(/:j_minus_3$/);
    expect(after.subscriptionStatus).toBe(MerchantSubscriptionStatus.active);
  });
});
