import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  MerchantSubscriptionInvoiceStatus,
  MerchantSubscriptionStatus,
  MerchantSubscriptionTier,
  MarketplacePaymentMethod,
  PrismaClient
} from "@prisma/client";
import { MerchantSubscriptionBillingService } from "../src/merchant-shop/merchant-subscription-billing.service";
import {
  addMonthsUtc,
  startOfUtcDay
} from "../src/merchant-shop/merchant-subscription.constants";
import { createTestAppWithGeniusPayMock, postGeniusPayWebhook } from "./helpers/create-test-app-with-geniuspay-mock";
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
import request from "supertest";

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
    process.env.GENIUSPAY_WEBHOOK_SECRET = "whsec_e2e_merchant_sub";

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
    await base.prisma.merchantSubscriptionPromoCode.deleteMany({
      where: { code: { startsWith: "E2E-" } }
    });
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

  it("choix Free masque pendingSubscription mais conserve la facture pending", async () => {
    const choose = await choosePremiumMobileMoney(app, merchant);
    expect(choose.status).toBe(201);
    expect(choose.body.pending).toBe(true);

    const mePending = await getMerchantMe(app, merchant);
    expect(mePending.body.subscriptionTier).toBeNull();
    expect(mePending.body.pendingSubscription).toBeTruthy();

    const free = await chooseFreeSubscription(app, merchant);
    expect(free.status).toBe(201);
    expect(free.body.subscriptionTier).toBe(MerchantSubscriptionTier.free);
    expect(free.body.pendingSubscription).toBeNull();

    const profile = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });
    const invoice = await base.prisma.merchantSubscriptionInvoice.findFirst({
      where: {
        merchantProfileId: profile.id,
        status: MerchantSubscriptionInvoiceStatus.pending
      }
    });
    expect(invoice).toBeTruthy();
  });

  it("après Free, reprise Premium mobile money réutilise la facture pending (pas GeniusPay wallet)", async () => {
    const first = await choosePremiumMobileMoney(app, merchant);
    expect(first.status).toBe(201);
    expect(first.body.pending).toBe(true);
    const firstRef = first.body.providerRef as string;
    const firstInvoiceId = first.body.invoiceId as string;

    const free = await chooseFreeSubscription(app, merchant);
    expect(free.status).toBe(201);
    expect(free.body.subscriptionTier).toBe(MerchantSubscriptionTier.free);
    expect(free.body.pendingSubscription).toBeNull();

    // Reprise Premium : la facture pending de période est réutilisée (createPendingInvoice).
    const again = await choosePremiumMobileMoney(app, merchant);
    expect(again.status).toBe(201);
    expect(again.body.pending).toBe(true);
    expect(again.body.invoiceId).toBe(firstInvoiceId);
    expect(again.body.paymentUrl).toBeTruthy();
    expect(again.body.providerRef).toBeTruthy();

    const me = await getMerchantMe(app, merchant);
    // Tier encore free jusqu'au paiement — pendingSubscription masqué tant que free.
    expect(me.body.subscriptionTier).toBe(MerchantSubscriptionTier.free);
    expect(me.body.pendingSubscription).toBeNull();

    const profile = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });
    const pendingCount = await base.prisma.merchantSubscriptionInvoice.count({
      where: {
        merchantProfileId: profile.id,
        status: MerchantSubscriptionInvoiceStatus.pending
      }
    });
    expect(pendingCount).toBe(1);

    // Confirmation du paiement (même ou nouvelle ref GeniusPay) → Premium.
    geniusPay.markPaymentCompleted(again.body.providerRef as string);
    const confirm = await confirmMerchantSubscription(
      app,
      merchant,
      again.body.providerRef as string
    );
    expect(confirm.status).toBe(201);
    expect(confirm.body.subscriptionTier).toBe(MerchantSubscriptionTier.premium);
    expect(confirm.body.pendingSubscription).toBeNull();

    // La première initiation n'a pas dû créer une 2e facture pending orpheline.
    expect(firstRef).toBeTruthy();
    expect(firstInvoiceId).toBe(again.body.invoiceId);
  });

  it("webhook payment.success → active Premium sans GET /payments", async () => {
    const choose = await choosePremiumMobileMoney(app, merchant);
    expect(choose.status).toBe(201);
    const providerRef = choose.body.providerRef as string;
    const invoiceId = choose.body.invoiceId as string;

    const webhook = await postGeniusPayWebhook(app, {
      id: "evt-merchant-sub-1",
      event: "payment.success",
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        reference: providerRef,
        amount: choose.body.amount,
        currency: "XOF",
        metadata: {
          kind: "merchant_subscription",
          user_id: merchant.merchantUserId,
          invoice_id: invoiceId,
          transaction_id: `merchant-sub:${invoiceId}`,
          amount: String(choose.body.amount)
        }
      }
    });
    expect(webhook.status).toBe(201);
    expect(webhook.body.ok).toBe(true);

    const me = await getMerchantMe(app, merchant);
    expect(me.body.subscriptionTier).toBe(MerchantSubscriptionTier.premium);
    expect(me.body.subscriptionStatus).toBe(MerchantSubscriptionStatus.active);
    expect(me.body.pendingSubscription).toBeNull();
  });

  it("webhook avec référence différente de la facture → met à jour providerRef", async () => {
    const choose = await choosePremiumMobileMoney(app, merchant);
    expect(choose.status).toBe(201);
    const invoiceId = choose.body.invoiceId as string;
    const paidRef = `${choose.body.providerRef}-paid`;

    const webhook = await postGeniusPayWebhook(app, {
      id: "evt-merchant-sub-2",
      event: "payment.success",
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        reference: paidRef,
        amount: choose.body.amount,
        currency: "XOF",
        metadata: {
          kind: "merchant_subscription",
          user_id: merchant.merchantUserId,
          invoice_id: invoiceId
        }
      }
    });
    expect(webhook.status).toBe(201);

    const profile = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });
    const invoice = await base.prisma.merchantSubscriptionInvoice.findUniqueOrThrow({
      where: { id: invoiceId }
    });
    expect(invoice.status).toBe(MerchantSubscriptionInvoiceStatus.paid);
    expect(invoice.providerRef).toBe(paidRef);
    expect(profile.subscriptionTier).toBe(MerchantSubscriptionTier.premium);
  });

  it("webhook sans kind mais référence facture en attente → active Premium", async () => {
    const choose = await choosePremiumMobileMoney(app, merchant);
    expect(choose.status).toBe(201);

    const webhook = await postGeniusPayWebhook(app, {
      id: "evt-merchant-sub-3",
      event: "payment.success",
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        reference: choose.body.providerRef,
        amount: choose.body.amount,
        currency: "XOF",
        metadata: {
          user_id: merchant.merchantUserId
        }
      }
    });
    expect(webhook.status).toBe(201);
    expect(webhook.body.resolvedByReference).toBe(true);

    const me = await getMerchantMe(app, merchant);
    expect(me.body.subscriptionTier).toBe(MerchantSubscriptionTier.premium);
  });

  it("relance createPendingInvoice sur paiement completed → active sans écraser providerRef", async () => {
    const choose = await choosePremiumMobileMoney(app, merchant);
    expect(choose.status).toBe(201);
    const invoiceId = choose.body.invoiceId as string;
    const providerRef = choose.body.providerRef as string;
    geniusPay.markPaymentCompleted(providerRef);

    const existing = await base.prisma.merchantSubscriptionInvoice.findUniqueOrThrow({
      where: { id: invoiceId }
    });
    const profile = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });
    const invoice = await billing.createPendingInvoice(
      profile.id,
      merchant.merchantUserId,
      existing.billingPeriodStart,
      Number(existing.amount)
    );

    expect(invoice.id).toBe(invoiceId);
    expect(invoice.status).toBe(MerchantSubscriptionInvoiceStatus.paid);
    expect(invoice.providerRef).toBe(providerRef);

    const after = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });
    expect(after.subscriptionTier).toBe(MerchantSubscriptionTier.premium);
  });

  it("payment.success orphelin → 404 (pas de ACK silencieux 200)", async () => {
    const webhook = await postGeniusPayWebhook(app, {
      id: "evt-merchant-orphan",
      event: "payment.success",
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        reference: "unknown-merchant-ref",
        amount: 5000,
        currency: "XOF",
        metadata: { user_id: merchant.merchantUserId }
      }
    });
    expect(webhook.status).toBe(404);
  });

  it("payment.failed → expire la facture pending commerçant", async () => {
    const choose = await choosePremiumMobileMoney(app, merchant);
    expect(choose.status).toBe(201);

    const webhook = await postGeniusPayWebhook(app, {
      id: "evt-merchant-fail-1",
      event: "payment.failed",
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        reference: choose.body.providerRef,
        amount: choose.body.amount,
        currency: "XOF",
        metadata: {
          kind: "merchant_subscription",
          user_id: merchant.merchantUserId,
          invoice_id: choose.body.invoiceId
        }
      }
    });
    expect(webhook.status).toBe(201);
    expect(webhook.body.expiredInvoice).toBe(true);

    const invoice = await base.prisma.merchantSubscriptionInvoice.findUniqueOrThrow({
      where: { id: choose.body.invoiceId }
    });
    expect(invoice.status).toBe(MerchantSubscriptionInvoiceStatus.expired);
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
    expect(profile.subscriptionStatus).toBe(MerchantSubscriptionStatus.cancelled);
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

  it("POST validate-code → prévisualise un code remise", async () => {
    await base.prisma.merchantSubscriptionPromoCode.create({
      data: {
        code: "E2E-PREVIEW",
        type: "discount",
        percentOff: 25,
        label: "Campagne test",
        isActive: true
      }
    });

    const res = await request(app.getHttpServer())
      .post("/api/v1/merchant/me/subscription/validate-code")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId)
      .send({ code: "E2E-PREVIEW" });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe("E2E-PREVIEW");
    expect(res.body.type).toBe("discount");
    expect(res.body.percentOff).toBe(25);
    expect(res.body.discountedPriceXof).toBe(3750);
    expect(res.body.fullPriceXof).toBe(5000);

    const redemptions = await base.prisma.merchantSubscriptionPromoRedemption.count();
    expect(redemptions).toBe(0);
  });

  it("code promo essai → statut trialing", async () => {
    await base.prisma.merchantSubscriptionPromoCode.create({
      data: {
        code: "E2E-TRIAL",
        type: "trial",
        trialUnits: 2,
        isActive: true
      }
    });

    const res = await request(app.getHttpServer())
      .post("/api/v1/merchant/me/subscription")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId)
      .send({
        tier: MerchantSubscriptionTier.premium,
        promoCode: "E2E-TRIAL"
      });

    expect(res.status).toBe(201);
    expect(res.body.subscriptionStatus).toBe(
      MerchantSubscriptionStatus.trialing
    );
    expect(res.body.subscriptionTier).toBe(MerchantSubscriptionTier.premium);
  });

  it("code remise 50 % → souscription wallet au tarif réduit", async () => {
    await base.prisma.merchantSubscriptionPromoCode.create({
      data: {
        code: "E2E-HALF",
        type: "discount",
        percentOff: 50,
        isActive: true
      }
    });
    await creditMerchantWallet(app, merchant.merchantToken, 3000);

    const res = await request(app.getHttpServer())
      .post("/api/v1/merchant/me/subscription")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId)
      .send({
        tier: MerchantSubscriptionTier.premium,
        paymentMethod: MarketplacePaymentMethod.wallet,
        promoCode: "E2E-HALF"
      });

    expect(res.status).toBe(201);
    expect(res.body.subscriptionTier).toBe(MerchantSubscriptionTier.premium);
    expect(res.body.promoPercentOffApplied).toBe(50);

    const profile = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });
    const paid = await base.prisma.merchantSubscriptionInvoice.findFirst({
      where: {
        merchantProfileId: profile.id,
        status: MerchantSubscriptionInvoiceStatus.paid
      }
    });
    expect(Number(paid?.amount)).toBe(2500);
  });

  it("après annulation → réactivation sans code = tarif plein", async () => {
    await base.prisma.merchantSubscriptionPromoCode.create({
      data: {
        code: "E2E-STICKY",
        type: "discount",
        percentOff: 50,
        isActive: true
      }
    });
    await creditMerchantWallet(app, merchant.merchantToken, 10_000);

    const withPromo = await request(app.getHttpServer())
      .post("/api/v1/merchant/me/subscription")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId)
      .send({
        tier: MerchantSubscriptionTier.premium,
        paymentMethod: MarketplacePaymentMethod.wallet,
        promoCode: "E2E-STICKY"
      });
    expect(withPromo.status).toBe(201);
    expect(withPromo.body.promoPercentOffApplied).toBe(50);

    const cancel = await request(app.getHttpServer())
      .post("/api/v1/merchant/me/subscription/cancel")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId);
    expect([200, 201]).toContain(cancel.status);
    expect(cancel.body.promoPercentOffApplied).toBeNull();

    const again = await request(app.getHttpServer())
      .post("/api/v1/merchant/me/subscription")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId)
      .send({
        tier: MerchantSubscriptionTier.premium,
        paymentMethod: MarketplacePaymentMethod.wallet
      });
    expect(again.status).toBe(201);
    expect(again.body.promoPercentOffApplied).toBeNull();

    const profile = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });
    const paid = await base.prisma.merchantSubscriptionInvoice.findMany({
      where: {
        merchantProfileId: profile.id,
        status: MerchantSubscriptionInvoiceStatus.paid
      },
      orderBy: { paidAt: "asc" }
    });
    // Même période UTC (@@unique) → une facture mise à jour au tarif plein.
    expect(paid.length).toBeGreaterThanOrEqual(1);
    expect(Number(paid[paid.length - 1]?.amount)).toBe(5000);
  });

  it("double utilisation du même code → refusé", async () => {
    await base.prisma.merchantSubscriptionPromoCode.create({
      data: {
        code: "E2E-ONCE",
        type: "trial",
        trialUnits: 1,
        isActive: true
      }
    });

    const first = await request(app.getHttpServer())
      .post("/api/v1/merchant/me/subscription")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId)
      .send({
        tier: MerchantSubscriptionTier.premium,
        promoCode: "E2E-ONCE"
      });
    expect(first.status).toBe(201);

    const profile = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });
    await base.prisma.merchantProfile.update({
      where: { id: profile.id },
      data: {
        subscriptionTier: null,
        subscriptionStatus: null,
        trialEndsAt: null,
        nextBillingAt: null
      }
    });

    const second = await request(app.getHttpServer())
      .post("/api/v1/merchant/me/subscription")
      .set("Authorization", `Bearer ${merchant.merchantToken}`)
      .set("X-Profile-Id", merchant.merchantProfileId)
      .send({
        tier: MerchantSubscriptionTier.premium,
        promoCode: "E2E-ONCE"
      });
    expect(second.status).toBe(400);
  });

  it("triggerRenewalCycleForProfile → facture pending", async () => {
    await seedActivePremiumDueToday(base.prisma, merchant.merchantUserId, {
      walletBalance: 0
    });
    const profile = await base.prisma.merchantProfile.findUniqueOrThrow({
      where: { userId: merchant.merchantUserId }
    });

    const result = await billing.triggerRenewalCycleForProfile(profile.id);

    expect(result.pendingInvoice).toBeTruthy();
    expect(result.pendingInvoice!.amount).toBe(5000);
    expect(result.pendingInvoice!.paymentUrl).toContain(
      "https://e2e.fermier.test/pay/"
    );
  });
});
