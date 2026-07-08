import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import {
  MarketplacePaymentMethod,
  MerchantSubscriptionTier
} from "@prisma/client";
import request from "supertest";
import {
  addMonthsUtc,
  startOfUtcDay
} from "../../src/merchant-shop/merchant-subscription.constants";
import { creditWalletViaDevTopUp } from "./wallet-payout-e2e";
import type { MerchantE2ECtx } from "./merchant-shop-e2e";

const E2E_MERCHANT_PHONE = "+2250700000099";

export async function isMerchantSubscriptionBillingSchemaReady(
  prisma: PrismaClient
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'MerchantSubscriptionInvoice'
  `;
  return rows.length > 0;
}

export async function prepareMerchantBillingE2e(
  prisma: PrismaClient,
  merchantUserId: string
): Promise<void> {
  await prisma.user.update({
    where: { id: merchantUserId },
    data: { phone: E2E_MERCHANT_PHONE }
  });
  await prisma.platformAccount.upsert({
    where: { id: "main" },
    create: {
      id: "main",
      aggregatorBalance: 50_000_000,
      totalVirtualBalance: 50_000_000
    },
    update: {
      aggregatorBalance: 50_000_000,
      totalVirtualBalance: 50_000_000
    }
  });
  await prisma.platformSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      merchantPremiumPriceXof: 5000
    },
    update: {
      merchantPremiumPriceXof: 5000
    }
  });
}

export async function resetMerchantSubscriptionBillingState(
  prisma: PrismaClient,
  merchantUserId: string
): Promise<string> {
  const profile = await prisma.merchantProfile.findUniqueOrThrow({
    where: { userId: merchantUserId }
  });

  await prisma.merchantSubscriptionInvoice.deleteMany({
    where: { merchantProfileId: profile.id }
  });
  await prisma.userWalletEntry.deleteMany({
    where: { wallet: { userId: merchantUserId } }
  });
  await prisma.userWallet.updateMany({
    where: { userId: merchantUserId },
    data: { balance: 0 }
  });

  await prisma.merchantProfile.update({
    where: { id: profile.id },
    data: {
      subscriptionTier: null,
      subscriptionStatus: null,
      subscriptionChosenAt: null,
      premiumPaidAt: null,
      nextBillingAt: null,
      graceEndsAt: null,
      billingReminderKey: null
    }
  });

  return profile.id;
}

export async function creditMerchantWallet(
  app: INestApplication,
  merchantToken: string,
  amount: number
): Promise<number> {
  return creditWalletViaDevTopUp({ app, token: merchantToken, amount });
}

export async function choosePremiumWallet(
  app: INestApplication,
  ctx: MerchantE2ECtx
) {
  return request(app.getHttpServer())
    .post("/api/v1/merchant/me/subscription")
    .set("Authorization", `Bearer ${ctx.merchantToken}`)
    .set("X-Profile-Id", ctx.merchantProfileId)
    .send({
      tier: MerchantSubscriptionTier.premium,
      paymentMethod: MarketplacePaymentMethod.wallet
    });
}

export async function choosePremiumMobileMoney(
  app: INestApplication,
  ctx: MerchantE2ECtx
) {
  return request(app.getHttpServer())
    .post("/api/v1/merchant/me/subscription")
    .set("Authorization", `Bearer ${ctx.merchantToken}`)
    .set("X-Profile-Id", ctx.merchantProfileId)
    .send({
      tier: MerchantSubscriptionTier.premium,
      paymentMethod: MarketplacePaymentMethod.mobile_money
    });
}

export async function confirmMerchantSubscription(
  app: INestApplication,
  ctx: MerchantE2ECtx,
  providerRef: string
) {
  return request(app.getHttpServer())
    .post("/api/v1/merchant/me/subscription/confirm")
    .set("Authorization", `Bearer ${ctx.merchantToken}`)
    .set("X-Profile-Id", ctx.merchantProfileId)
    .send({ providerRef });
}

export async function renewMerchantSubscription(
  app: INestApplication,
  ctx: MerchantE2ECtx
) {
  return request(app.getHttpServer())
    .post("/api/v1/merchant/me/subscription/renew")
    .set("Authorization", `Bearer ${ctx.merchantToken}`)
    .set("X-Profile-Id", ctx.merchantProfileId);
}

export async function getMerchantMe(app: INestApplication, ctx: MerchantE2ECtx) {
  return request(app.getHttpServer())
    .get("/api/v1/merchant/me")
    .set("Authorization", `Bearer ${ctx.merchantToken}`)
    .set("X-Profile-Id", ctx.merchantProfileId);
}

export async function seedActivePremiumDueToday(
  prisma: PrismaClient,
  merchantUserId: string,
  options?: { walletBalance?: number }
) {
  const today = startOfUtcDay(new Date());
  const profile = await prisma.merchantProfile.findUniqueOrThrow({
    where: { userId: merchantUserId }
  });

  await prisma.merchantProfile.update({
    where: { id: profile.id },
    data: {
      subscriptionTier: MerchantSubscriptionTier.premium,
      subscriptionStatus: "active",
      subscriptionChosenAt: addMonthsUtc(today, -1),
      premiumPaidAt: addMonthsUtc(today, -1),
      nextBillingAt: today,
      graceEndsAt: null,
      billingReminderKey: null
    }
  });

  if (options?.walletBalance != null) {
    await prisma.userWallet.upsert({
      where: { userId: merchantUserId },
      create: {
        userId: merchantUserId,
        balance: options.walletBalance
      },
      update: { balance: options.walletBalance }
    });
  }

  return { profileId: profile.id, billingDay: today };
}

export async function seedPastDuePremiumGraceExpired(
  prisma: PrismaClient,
  merchantUserId: string
) {
  const today = startOfUtcDay(new Date());
  const profile = await prisma.merchantProfile.findUniqueOrThrow({
    where: { userId: merchantUserId }
  });

  await prisma.merchantProfile.update({
    where: { id: profile.id },
    data: {
      subscriptionTier: MerchantSubscriptionTier.premium,
      subscriptionStatus: "past_due",
      subscriptionChosenAt: addMonthsUtc(today, -2),
      premiumPaidAt: addMonthsUtc(today, -2),
      nextBillingAt: addMonthsUtc(today, -7),
      graceEndsAt: today,
      billingReminderKey: null
    }
  });

  await prisma.merchantSubscriptionInvoice.create({
    data: {
      merchantProfileId: profile.id,
      amount: 5000,
      currency: "XOF",
      status: "pending",
      billingPeriodStart: addMonthsUtc(today, -7),
      billingPeriodEnd: addMonthsUtc(today, -6),
      dueDate: addMonthsUtc(today, -7),
      providerRef: `e2e-pending-invoice-${Date.now()}`
    }
  });

  return profile.id;
}
