import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PrismaClient } from "@prisma/client";
import {
  MerchantSubscriptionTier,
  ProfileType
} from "@prisma/client";
import * as jwt from "jsonwebtoken";
import request from "supertest";
import type { E2ESeedResult } from "./e2e-seed";

export type MerchantE2ECtx = {
  merchantUserId: string;
  merchantProfileId: string;
  merchantToken: string;
  categoryId: string;
  shopId: string;
  productIds: string[];
};

export async function seedMerchantE2E(
  prisma: PrismaClient,
  _base: E2ESeedResult
): Promise<MerchantE2ECtx> {
  const secret = process.env.SUPABASE_JWT_SECRET!;
  const merchantSub = "33333333-3333-3333-3333-333333333333";

  await prisma.merchantProductModerationLog.deleteMany({});
  await prisma.merchantOrder.deleteMany({});
  await prisma.merchantProduct.deleteMany({});
  await prisma.merchantShop.deleteMany({});
  await prisma.merchantSubscriptionInvoice.deleteMany({});
  await prisma.merchantProductCategory.deleteMany({});
  await prisma.merchantProfile.deleteMany({
    where: {
      OR: [
        { user: { email: "e2e-merchant@fermier.local" } },
        { user: { supabaseUserId: merchantSub } }
      ]
    }
  });
  await prisma.profile.deleteMany({
    where: {
      OR: [
        { user: { email: "e2e-merchant@fermier.local" } },
        { user: { supabaseUserId: merchantSub } }
      ]
    }
  });
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: "e2e-merchant@fermier.local" },
        { supabaseUserId: merchantSub }
      ]
    }
  });

  const merchantUser = await prisma.user.create({
    data: {
      supabaseUserId: merchantSub,
      email: "e2e-merchant@fermier.local",
      fullName: "E2E Merchant"
    }
  });

  const merchantProfileRow = await prisma.profile.create({
    data: {
      userId: merchantUser.id,
      type: ProfileType.merchant,
      isDefault: true
    }
  });

  await prisma.merchantProfile.create({
    data: { userId: merchantUser.id }
  });

  const category = await prisma.merchantProductCategory.create({
    data: { name: "Alimentation", slug: "alimentation-e2e" }
  });

  const merchantToken = jwt.sign(
    { sub: merchantSub, email: merchantUser.email },
    secret,
    { expiresIn: "1h" }
  );

  return {
    merchantUserId: merchantUser.id,
    merchantProfileId: merchantProfileRow.id,
    merchantToken,
    categoryId: category.id,
    shopId: "",
    productIds: []
  };
}

export async function createMerchantShop(
  app: NestExpressApplication,
  ctx: MerchantE2ECtx
) {
  const res = await request(app.getHttpServer())
    .post("/api/v1/merchant/shops")
    .set("Authorization", `Bearer ${ctx.merchantToken}`)
    .set("X-Profile-Id", ctx.merchantProfileId)
    .send({ name: "Boutique E2E" });
  ctx.shopId = res.body.id as string;
  return res;
}

export async function createMerchantProduct(
  app: NestExpressApplication,
  ctx: MerchantE2ECtx,
  name: string,
  stock = 10
) {
  const res = await request(app.getHttpServer())
    .post(`/api/v1/merchant/shops/${ctx.shopId}/products`)
    .set("Authorization", `Bearer ${ctx.merchantToken}`)
    .set("X-Profile-Id", ctx.merchantProfileId)
    .send({
      name,
      categoryId: ctx.categoryId,
      price: 1000,
      stock
    });
  ctx.productIds.push(res.body.id as string);
  return res;
}

export async function chooseFreeSubscription(
  app: NestExpressApplication,
  ctx: MerchantE2ECtx
) {
  return request(app.getHttpServer())
    .post("/api/v1/merchant/me/subscription")
    .set("Authorization", `Bearer ${ctx.merchantToken}`)
    .set("X-Profile-Id", ctx.merchantProfileId)
    .send({ tier: MerchantSubscriptionTier.free });
}

export async function publishProduct(
  app: NestExpressApplication,
  ctx: MerchantE2ECtx,
  productId: string
) {
  return request(app.getHttpServer())
    .post(`/api/v1/merchant/products/${productId}/publish`)
    .set("Authorization", `Bearer ${ctx.merchantToken}`)
    .set("X-Profile-Id", ctx.merchantProfileId);
}

export async function cleanupMerchantE2E(
  prisma: PrismaClient,
  ctx: MerchantE2ECtx,
  base: E2ESeedResult
) {
  await prisma.platformRevenue.deleteMany({
    where: {
      OR: [
        { buyerId: base.peerUserId },
        { sellerId: ctx.merchantUserId }
      ]
    }
  });
  await prisma.merchantOrder.deleteMany({
    where: {
      OR: [
        { buyerUserId: base.peerUserId },
        { sellerUserId: ctx.merchantUserId }
      ]
    }
  });
  await prisma.merchantProductModerationLog.deleteMany({});
  await prisma.merchantSubscriptionInvoice.deleteMany({
    where: { merchantProfile: { userId: ctx.merchantUserId } }
  });
  await prisma.merchantProduct.deleteMany({
    where: { shop: { merchantProfile: { userId: ctx.merchantUserId } } }
  });
  await prisma.merchantShop.deleteMany({
    where: { merchantProfile: { userId: ctx.merchantUserId } }
  });
  await prisma.merchantProfile.deleteMany({
    where: { userId: ctx.merchantUserId }
  });
  await prisma.profile.deleteMany({ where: { userId: ctx.merchantUserId } });
  await prisma.user.deleteMany({ where: { id: ctx.merchantUserId } });
  await prisma.merchantProductCategory.deleteMany({
    where: { id: ctx.categoryId }
  });
}
