import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  MerchantSubscriptionInvoiceStatus,
  MerchantSubscriptionStatus,
  MerchantSubscriptionTier,
  MarketplacePaymentMethod,
  PrismaClient,
  ProfileType
} from "@prisma/client";
import request from "supertest";
import { ProducerSubscriptionBillingService } from "../src/producer-subscription/producer-subscription-billing.service";
import {
  createTestAppWithGeniusPayMock,
  postGeniusPayWebhook
} from "./helpers/create-test-app-with-geniuspay-mock";
import {
  cleanupE2eVetRbacFixtures,
  seedE2eVetRbacFixtures,
  type E2EVetRbacSeedResult
} from "./helpers/e2e-vet-rbac-seed";
import type { GeniusPayE2eMock } from "./mocks/geniuspay-e2e.mock";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

async function isProducerSubscriptionSchemaReady(
  prisma: PrismaClient
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ProducerSubscriptionInvoice'
  `;
  return rows.length >= 1;
}

async function chooseProducerPremiumMobileMoney(
  app: NestExpressApplication,
  token: string,
  profileId: string
) {
  return request(app.getHttpServer())
    .post("/api/v1/producers/me/subscription")
    .set("Authorization", `Bearer ${token}`)
    .set("X-Profile-Id", profileId)
    .send({
      tier: MerchantSubscriptionTier.premium,
      paymentMethod: MarketplacePaymentMethod.mobile_money
    });
}

async function confirmProducerPremium(
  app: NestExpressApplication,
  token: string,
  profileId: string,
  providerRef: string,
  invoiceId: string
) {
  return request(app.getHttpServer())
    .post("/api/v1/producers/me/subscription/confirm")
    .set("Authorization", `Bearer ${token}`)
    .set("X-Profile-Id", profileId)
    .send({ providerRef, invoiceId });
}

async function getProducerMe(
  app: NestExpressApplication,
  token: string,
  profileId: string
) {
  return request(app.getHttpServer())
    .get("/api/v1/producers/me")
    .set("Authorization", `Bearer ${token}`)
    .set("X-Profile-Id", profileId);
}

describeOrSkip("Abonnement Premium producteur — GeniusPay webhook (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2EVetRbacSeedResult;
  let geniusPay: GeniusPayE2eMock;
  let billing: ProducerSubscriptionBillingService;
  let producerProfileId: string;
  let producerToken: string;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    process.env.MOBILE_MONEY_PROVIDER = "geniuspay";
    process.env.FEATURE_WALLET = "true";
    process.env.MERCHANT_SUBSCRIPTION_SMS_ENABLED = "false";
    process.env.GENIUSPAY_WEBHOOK_SECRET = "whsec_e2e_producer_sub";

    ctx = await seedE2eVetRbacFixtures(PrismaClient);
    if (!(await isProducerSubscriptionSchemaReady(ctx.prisma))) {
      throw new Error(
        "Schéma DB incomplet pour les e2e Premium producteur. Exécutez la migration 20260710120000."
      );
    }

    const profile = await ctx.prisma.profile.findFirstOrThrow({
      where: { userId: ctx.producerUserId, type: ProfileType.producer },
      select: { id: true }
    });
    producerProfileId = profile.id;
    producerToken = ctx.producerToken;

    await ctx.prisma.user.update({
      where: { id: ctx.producerUserId },
      data: { phone: "+2250700000088" }
    });

    await ctx.prisma.platformSettings.upsert({
      where: { id: "default" },
      create: { id: "default", producerPremiumPriceXof: 5000 },
      update: { producerPremiumPriceXof: 5000 }
    });

    const created = await createTestAppWithGeniusPayMock();
    app = created.app;
    geniusPay = created.geniusPay;
    billing = app.get(ProducerSubscriptionBillingService);
  });

  beforeEach(async () => {
    geniusPay.reset();
    await ctx.prisma.producerSubscriptionInvoice.deleteMany({
      where: { producerProfile: { userId: ctx.producerUserId } }
    });

    const resetData = {
      subscriptionTier: MerchantSubscriptionTier.free,
      subscriptionStatus: null,
      subscriptionChosenAt: new Date(),
      premiumPaidAt: null,
      nextBillingAt: null,
      graceEndsAt: null,
      billingReminderKey: null,
      trialEndsAt: null,
      cancelledAt: null,
      suspendedAt: null,
      suspensionReason: null
    };

    const existing = await ctx.prisma.producerProfile.findUnique({
      where: { userId: ctx.producerUserId }
    });
    if (existing) {
      await ctx.prisma.producerProfile.update({
        where: { id: existing.id },
        data: resetData
      });
    } else {
      await ctx.prisma.producerProfile.create({
        data: {
          userId: ctx.producerUserId,
          ...resetData
        }
      });
    }
  });

  afterAll(async () => {
    await app?.close();
    await cleanupE2eVetRbacFixtures(ctx.prisma, ctx);
  });

  it("webhook payment.success → active Premium producteur sans GET", async () => {
    const choose = await chooseProducerPremiumMobileMoney(
      app,
      producerToken,
      producerProfileId
    );
    expect(choose.status).toBe(201);
    const providerRef = choose.body.providerRef as string;
    const invoiceId = choose.body.invoiceId as string;

    const webhook = await postGeniusPayWebhook(app, {
      id: "evt-producer-sub-1",
      event: "payment.success",
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        reference: providerRef,
        amount: choose.body.amount,
        currency: "XOF",
        metadata: {
          kind: "producer_subscription",
          user_id: ctx.producerUserId,
          invoice_id: invoiceId,
          transaction_id: `producer-sub:${invoiceId}`,
          amount: String(choose.body.amount)
        }
      }
    });
    expect(webhook.status).toBe(201);
    expect(webhook.body.ok).toBe(true);

    const me = await getProducerMe(app, producerToken, producerProfileId);
    expect(me.body.teamPremiumActive).toBe(true);
    expect(me.body.subscriptionTier).toBe(MerchantSubscriptionTier.premium);
  });

  it("confirm sync GET accepte kind producer_subscription", async () => {
    const choose = await chooseProducerPremiumMobileMoney(
      app,
      producerToken,
      producerProfileId
    );
    expect(choose.status).toBe(201);
    geniusPay.markPaymentCompleted(choose.body.providerRef);

    const confirm = await confirmProducerPremium(
      app,
      producerToken,
      producerProfileId,
      choose.body.providerRef,
      choose.body.invoiceId
    );
    expect(confirm.status).toBe(201);
    expect(confirm.body.teamPremiumActive).toBe(true);
  });

  it("relance createPendingInvoice sur paiement completed → active sans nouvelle ref", async () => {
    const choose = await chooseProducerPremiumMobileMoney(
      app,
      producerToken,
      producerProfileId
    );
    expect(choose.status).toBe(201);
    const invoiceId = choose.body.invoiceId as string;
    const providerRef = choose.body.providerRef as string;
    geniusPay.markPaymentCompleted(providerRef);

    const existing = await ctx.prisma.producerSubscriptionInvoice.findUniqueOrThrow({
      where: { id: invoiceId }
    });
    const producerProfile = await ctx.prisma.producerProfile.findUniqueOrThrow({
      where: { userId: ctx.producerUserId }
    });
    const invoice = await billing.createPendingInvoice(
      producerProfile.id,
      ctx.producerUserId,
      existing.billingPeriodStart,
      Number(existing.amount)
    );

    expect(invoice.id).toBe(invoiceId);
    expect(invoice.status).toBe(MerchantSubscriptionInvoiceStatus.paid);
    expect(invoice.providerRef).toBe(providerRef);

    const profile = await ctx.prisma.producerProfile.findUniqueOrThrow({
      where: { userId: ctx.producerUserId }
    });
    expect(profile.subscriptionTier).toBe(MerchantSubscriptionTier.premium);
    expect(profile.subscriptionStatus).toBe(MerchantSubscriptionStatus.active);
  });

  it("payment.success non résolu → 404 (pas de ACK silencieux)", async () => {
    const webhook = await postGeniusPayWebhook(app, {
      id: "evt-orphan-1",
      event: "payment.success",
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        reference: "orphan-ref-unknown",
        amount: 5000,
        currency: "XOF",
        metadata: { user_id: ctx.producerUserId }
      }
    });
    expect(webhook.status).toBe(404);
  });

  it("payment.failed → expire la facture pending", async () => {
    const choose = await chooseProducerPremiumMobileMoney(
      app,
      producerToken,
      producerProfileId
    );
    expect(choose.status).toBe(201);
    expect(choose.body.invoiceId).toBeTruthy();
    expect(choose.body.providerRef).toBeTruthy();

    const webhook = await postGeniusPayWebhook(
      app,
      {
        id: "evt-producer-fail-1",
        event: "payment.failed",
        timestamp: Math.floor(Date.now() / 1000),
        data: {
          reference: choose.body.providerRef,
          amount: choose.body.amount,
          currency: "XOF",
          metadata: {
            kind: "producer_subscription",
            user_id: ctx.producerUserId,
            invoice_id: choose.body.invoiceId
          }
        }
      },
      process.env.GENIUSPAY_WEBHOOK_SECRET
    );
    expect(webhook.status).toBe(201);

    const invoice = await ctx.prisma.producerSubscriptionInvoice.findUniqueOrThrow({
      where: { id: choose.body.invoiceId }
    });
    expect(invoice.status).toBe(MerchantSubscriptionInvoiceStatus.expired);
  });
});
