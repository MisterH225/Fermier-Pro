import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import {
  MarketplaceFundMovementKind,
  MarketplacePaymentMethod,
  WithdrawalRequestStatus
} from "@prisma/client";
import request from "supertest";
import {
  advanceMarketplaceToSellerShipped,
  setupMarketplaceDeliveryListing,
  type MarketplaceDeliveryCtx
} from "./marketplace-delivery-e2e";
import { purgeMarketplaceForUsers } from "./e2e-seed";

const E2E_PHONE = "+2250700000001";
const E2E_SELLER_PHONE = "+2250700000002";

export async function prepareWalletE2eUsers(
  prisma: PrismaClient,
  userIds: { buyerUserId: string; sellerUserId: string }
): Promise<void> {
  await prisma.user.update({
    where: { id: userIds.buyerUserId },
    data: { phone: E2E_PHONE }
  });
  await prisma.user.update({
    where: { id: userIds.sellerUserId },
    data: { phone: E2E_SELLER_PHONE }
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
}

export async function purgeWalletE2eData(
  prisma: PrismaClient,
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) {
    return;
  }
  await prisma.withdrawalRequest.deleteMany({
    where: { userId: { in: userIds } }
  });
  await prisma.userWalletEntry.deleteMany({
    where: { wallet: { userId: { in: userIds } } }
  });
  await prisma.userWallet.deleteMany({
    where: { userId: { in: userIds } }
  });
}

export async function creditWalletViaDevTopUp(params: {
  app: INestApplication;
  token: string;
  amount: number;
}): Promise<number> {
  const init = await request(params.app.getHttpServer())
    .post("/api/v1/users/me/wallet/top-up/initiate")
    .set("Authorization", `Bearer ${params.token}`)
    .send({ amount: params.amount });
  if (![200, 201].includes(init.status)) {
    throw new Error(
      `top-up initiate failed: ${init.status} ${JSON.stringify(init.body)}`
    );
  }
  const confirm = await request(params.app.getHttpServer())
    .post("/api/v1/users/me/wallet/top-up/confirm")
    .set("Authorization", `Bearer ${params.token}`)
    .send({ providerRef: init.body.providerRef });
  if (![200, 201].includes(confirm.status)) {
    throw new Error(
      `top-up confirm failed: ${confirm.status} ${JSON.stringify(confirm.body)}`
    );
  }
  return Number(confirm.body.balance);
}

export async function withdrawWalletViaDevGateway(params: {
  app: INestApplication;
  token: string;
  amount: number;
  clientRequestId: string;
}): Promise<{ providerRef: string; balance: number }> {
  const init = await request(params.app.getHttpServer())
    .post("/api/v1/users/me/wallet/withdraw/initiate")
    .set("Authorization", `Bearer ${params.token}`)
    .send({
      amount: params.amount,
      phone: E2E_PHONE,
      clientRequestId: params.clientRequestId
    });
  if (![200, 201].includes(init.status)) {
    throw new Error(
      `withdraw initiate failed: ${init.status} ${JSON.stringify(init.body)}`
    );
  }
  expect(init.body.requiresApproval).toBe(false);

  const confirm = await request(params.app.getHttpServer())
    .post("/api/v1/users/me/wallet/withdraw/confirm")
    .set("Authorization", `Bearer ${params.token}`)
    .send({
      amount: params.amount,
      providerRef: init.body.providerRef,
      withdrawalRequestId: init.body.withdrawalRequestId,
      phone: E2E_PHONE
    });
  if (![200, 201].includes(confirm.status)) {
    throw new Error(
      `withdraw confirm failed: ${confirm.status} ${JSON.stringify(confirm.body)}`
    );
  }
  return {
    providerRef: init.body.providerRef as string,
    balance: Number(confirm.body.balance)
  };
}

export async function payMarketplaceMobileMoney(params: {
  app: INestApplication;
  buyerToken: string;
  transactionId: string;
}): Promise<string> {
  const init = await request(params.app.getHttpServer())
    .post(
      `/api/v1/marketplace/transactions/${params.transactionId}/payment/initiate`
    )
    .set("Authorization", `Bearer ${params.buyerToken}`)
    .send({ paymentMethod: "mobile_money" });
  expect(init.status).toBe(201);
  expect(init.body.paymentMethod).toBe(MarketplacePaymentMethod.mobile_money);
  const providerRef = init.body.providerRef as string;

  const confirm = await request(params.app.getHttpServer())
    .post(
      `/api/v1/marketplace/transactions/${params.transactionId}/payment/confirm`
    )
    .set("Authorization", `Bearer ${params.buyerToken}`)
    .send({ providerRef });
  expect(confirm.status).toBe(201);
  expect(confirm.body.status).toBe("PAYMENT_HELD");
  return providerRef;
}

export async function payMarketplaceWallet(params: {
  app: INestApplication;
  buyerToken: string;
  transactionId: string;
}): Promise<string> {
  const init = await request(params.app.getHttpServer())
    .post(
      `/api/v1/marketplace/transactions/${params.transactionId}/payment/initiate`
    )
    .set("Authorization", `Bearer ${params.buyerToken}`)
    .send({ paymentMethod: "wallet" });
  expect(init.status).toBe(201);
  expect(init.body.paymentMethod).toBe(MarketplacePaymentMethod.wallet);
  const providerRef = init.body.providerRef as string;

  const confirm = await request(params.app.getHttpServer())
    .post(
      `/api/v1/marketplace/transactions/${params.transactionId}/payment/confirm`
    )
    .set("Authorization", `Bearer ${params.buyerToken}`)
    .send({ providerRef });
  expect(confirm.status).toBe(201);
  expect(confirm.body.status).toBe("PAYMENT_HELD");
  return providerRef;
}

export async function closeMarketplaceTransaction(params: {
  app: INestApplication;
  buyerToken: string;
  ctx: MarketplaceDeliveryCtx;
}): Promise<void> {
  const receipt = await request(params.app.getHttpServer())
    .post(
      `/api/v1/marketplace/transactions/${params.ctx.transactionId}/confirm-receipt`
    )
    .set("Authorization", `Bearer ${params.buyerToken}`)
    .send({
      receivedAt: new Date().toISOString().slice(0, 10),
      condition: "conform",
      receivedAnimalIds: [params.ctx.animalId]
    });
  if (receipt.status !== 201) {
    throw new Error(
      `confirm-receipt failed: ${receipt.status} ${JSON.stringify(receipt.body)}`
    );
  }
  expect(receipt.body.status).toBe("TRANSACTION_CLOSED");
}

export async function cleanupBuyerMarketplaceState(
  prisma: PrismaClient,
  userIds: string | string[]
): Promise<void> {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  await purgeMarketplaceForUsers(prisma, ids);
  await prisma.marketplaceOffer.deleteMany({
    where: { buyerUserId: { in: ids } }
  });
}

export async function setupMarketplaceListingOnly(params: {
  app: INestApplication;
  prisma: PrismaClient;
  sellerToken: string;
  sellerProfileId: string;
  sellerFarmId: string;
  buyerToken: string;
  buyerFarmId: string;
}): Promise<MarketplaceDeliveryCtx> {
  return setupMarketplaceDeliveryListing(params);
}

export async function runMarketplaceSettlementHappyPath(params: {
  app: INestApplication;
  sellerToken: string;
  buyerToken: string;
  ctx: MarketplaceDeliveryCtx;
  payment: "mobile_money" | "wallet";
  topUpAmount?: number;
}): Promise<void> {
  if (params.payment === "wallet") {
    await creditWalletViaDevTopUp({
      app: params.app,
      token: params.buyerToken,
      amount: params.topUpAmount ?? 200_000
    });
    await payMarketplaceWallet({
      app: params.app,
      buyerToken: params.buyerToken,
      transactionId: params.ctx.transactionId
    });
  } else {
    await payMarketplaceMobileMoney({
      app: params.app,
      buyerToken: params.buyerToken,
      transactionId: params.ctx.transactionId
    });
  }

  await advanceMarketplaceToSellerShipped({
    app: params.app,
    sellerToken: params.sellerToken,
    buyerToken: params.buyerToken,
    transactionId: params.ctx.transactionId,
    animalId: params.ctx.animalId
  });

  const receipt = await request(params.app.getHttpServer())
    .post(
      `/api/v1/marketplace/transactions/${params.ctx.transactionId}/confirm-receipt`
    )
    .set("Authorization", `Bearer ${params.buyerToken}`)
    .send({
      receivedAt: new Date().toISOString().slice(0, 10),
      condition: "conform",
      receivedAnimalIds: [params.ctx.animalId]
    });
  if (receipt.status !== 201) {
    throw new Error(
      `confirm-receipt failed: ${receipt.status} ${JSON.stringify(receipt.body)}`
    );
  }
  expect(receipt.body.status).toBe("TRANSACTION_CLOSED");
}

export async function setupPaidMarketplaceForPayout(params: {
  app: INestApplication;
  prisma: PrismaClient;
  sellerToken: string;
  sellerProfileId: string;
  sellerFarmId: string;
  buyerToken: string;
  buyerUserId: string;
  buyerFarmId: string;
  payment: "mobile_money" | "wallet";
  topUpAmount?: number;
}): Promise<MarketplaceDeliveryCtx> {
  const listing = await setupMarketplaceDeliveryListing({
    app: params.app,
    prisma: params.prisma,
    sellerToken: params.sellerToken,
    sellerProfileId: params.sellerProfileId,
    sellerFarmId: params.sellerFarmId,
    buyerToken: params.buyerToken,
    buyerFarmId: params.buyerFarmId
  });

  if (params.payment === "wallet") {
    const tx = await params.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { id: listing.transactionId },
      select: { blockedAmount: true }
    });
    const needed = Math.ceil(Number(tx.blockedAmount)) + 5_000;
    await creditWalletViaDevTopUp({
      app: params.app,
      token: params.buyerToken,
      amount: params.topUpAmount ?? needed
    });
    await payMarketplaceWallet({
      app: params.app,
      buyerToken: params.buyerToken,
      transactionId: listing.transactionId
    });
  } else {
    await payMarketplaceMobileMoney({
      app: params.app,
      buyerToken: params.buyerToken,
      transactionId: listing.transactionId
    });
  }

  await advanceMarketplaceToSellerShipped({
    app: params.app,
    sellerToken: params.sellerToken,
    buyerToken: params.buyerToken,
    transactionId: listing.transactionId,
    animalId: listing.animalId
  });

  return listing;
}

export async function assertFundMovement(
  prisma: PrismaClient,
  transactionId: string,
  kind: MarketplaceFundMovementKind,
  providerRefPattern?: RegExp
): Promise<void> {
  const movement = await prisma.marketplaceFundMovement.findFirst({
    where: { transactionId, kind }
  });
  expect(movement).toBeTruthy();
  if (providerRefPattern) {
    expect(movement!.providerRef).toMatch(providerRefPattern);
  }
}

export async function assertWithdrawalCompleted(
  prisma: PrismaClient,
  userId: string,
  providerRef: string
): Promise<void> {
  const row = await prisma.withdrawalRequest.findFirst({
    where: { userId, providerRef }
  });
  expect(row).toBeTruthy();
  expect(row!.status).toBe(WithdrawalRequestStatus.completed);
}
