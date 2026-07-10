import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PrismaClient } from "@prisma/client";
import {
  MerchantSubscriptionTier,
  ProfileType
} from "@prisma/client";
import * as jwt from "jsonwebtoken";
import request from "supertest";
import { withMerchantCatalogHardDelete } from "../../src/merchant-shop/merchant-catalog-protection";
import type { E2ESeedResult } from "./e2e-seed";

export type MerchantE2ECtx = {
  merchantUserId: string;
  merchantProfileId: string;
  merchantToken: string;
  categoryId: string;
  shopId: string;
  productIds: string[];
};

const E2E_MERCHANT_SUB = "33333333-3333-3333-3333-333333333333";
const E2E_MERCHANT_EMAIL = "e2e-merchant@fermier.local";

/**
 * Nettoie uniquement le commerçant e2e (jamais le catalogue réel).
 * Les DELETE shop/product passent par withMerchantCatalogHardDelete (trigger DB).
 */
export async function seedMerchantE2E(
  prisma: PrismaClient,
  _base: E2ESeedResult
): Promise<MerchantE2ECtx> {
  const secret = process.env.SUPABASE_JWT_SECRET!;
  const e2eMerchantWhere = {
    OR: [
      { user: { email: E2E_MERCHANT_EMAIL } },
      { user: { supabaseUserId: E2E_MERCHANT_SUB } }
    ]
  };

  const e2eMerchantUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: E2E_MERCHANT_EMAIL },
        { supabaseUserId: E2E_MERCHANT_SUB }
      ]
    },
    select: { id: true }
  });
  const e2eMerchantUserIds = e2eMerchantUsers.map((u) => u.id);

  if (e2eMerchantUserIds.length > 0) {
    await withMerchantCatalogHardDelete(prisma, async (tx) => {
      await tx.merchantProductModerationLog.deleteMany({
        where: {
          product: {
            shop: { merchantProfile: { userId: { in: e2eMerchantUserIds } } }
          }
        }
      });
      await tx.platformRevenue.deleteMany({
        where: {
          OR: [
            { sellerId: { in: e2eMerchantUserIds } },
            { buyerId: { in: e2eMerchantUserIds } }
          ]
        }
      });
      await tx.merchantOrder.deleteMany({
        where: {
          OR: [
            { sellerUserId: { in: e2eMerchantUserIds } },
            { buyerUserId: { in: e2eMerchantUserIds } }
          ]
        }
      });
      try {
        await tx.buyerMerchantFavorite.deleteMany({
          where: {
            product: {
              shop: { merchantProfile: { userId: { in: e2eMerchantUserIds } } }
            }
          }
        });
      } catch (error: unknown) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: string }).code)
            : "";
        if (code !== "P2021") {
          throw error;
        }
      }
      await tx.merchantProduct.deleteMany({
        where: {
          shop: { merchantProfile: { userId: { in: e2eMerchantUserIds } } }
        }
      });
      await tx.merchantShop.deleteMany({
        where: { merchantProfile: { userId: { in: e2eMerchantUserIds } } }
      });
      await tx.merchantSubscriptionInvoice.deleteMany({
        where: { merchantProfile: { userId: { in: e2eMerchantUserIds } } }
      });
      await tx.merchantProfile.deleteMany({ where: e2eMerchantWhere });
    });
  }

  await prisma.profile.deleteMany({ where: e2eMerchantWhere });
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: E2E_MERCHANT_EMAIL },
        { supabaseUserId: E2E_MERCHANT_SUB }
      ]
    }
  });
  await prisma.merchantProductCategory.deleteMany({
    where: { slug: "alimentation-e2e" }
  });

  const merchantUser = await prisma.user.create({
    data: {
      supabaseUserId: E2E_MERCHANT_SUB,
      email: E2E_MERCHANT_EMAIL,
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
    { sub: E2E_MERCHANT_SUB, email: merchantUser.email },
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
  await withMerchantCatalogHardDelete(prisma, async (tx) => {
    await tx.platformRevenue.deleteMany({
      where: {
        OR: [
          { buyerId: base.peerUserId },
          { sellerId: ctx.merchantUserId }
        ]
      }
    });
    await tx.merchantOrder.deleteMany({
      where: {
        OR: [
          { buyerUserId: base.peerUserId },
          { sellerUserId: ctx.merchantUserId }
        ]
      }
    });
    await tx.merchantProductModerationLog.deleteMany({
      where: {
        product: {
          shop: { merchantProfile: { userId: ctx.merchantUserId } }
        }
      }
    });
    try {
      await tx.buyerMerchantFavorite.deleteMany({
        where: {
          product: { shop: { merchantProfile: { userId: ctx.merchantUserId } } }
        }
      });
    } catch (error: unknown) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: string }).code)
          : "";
      if (code !== "P2021") {
        throw error;
      }
    }
    await tx.merchantSubscriptionInvoice.deleteMany({
      where: { merchantProfile: { userId: ctx.merchantUserId } }
    });
    await tx.merchantProduct.deleteMany({
      where: { shop: { merchantProfile: { userId: ctx.merchantUserId } } }
    });
    await tx.merchantShop.deleteMany({
      where: { merchantProfile: { userId: ctx.merchantUserId } }
    });
    await tx.merchantProfile.deleteMany({
      where: { userId: ctx.merchantUserId }
    });
  });

  await prisma.profile.deleteMany({ where: { userId: ctx.merchantUserId } });
  await prisma.user.deleteMany({ where: { id: ctx.merchantUserId } });
  await prisma.merchantProductCategory.deleteMany({
    where: { id: ctx.categoryId }
  });
}
