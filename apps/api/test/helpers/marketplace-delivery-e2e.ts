import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { AnimalSex } from "@prisma/client";
import request from "supertest";

export type MarketplaceDeliveryCtx = {
  listingId: string;
  offerId: string;
  transactionId: string;
  animalId: string;
  buyerFarmId: string;
};

export async function seedBuyerFarm(
  prisma: PrismaClient,
  buyerUserId: string
): Promise<string> {
  const farm = await prisma.farm.create({
    data: {
      ownerId: buyerUserId,
      name: "Ferme acheteur E2E marketplace",
      speciesFocus: "porcin",
      livestockMode: "batch"
    }
  });
  return farm.id;
}

async function createListingAnimal(
  prisma: PrismaClient,
  farmId: string
): Promise<string> {
  const species = await prisma.species.findUniqueOrThrow({
    where: { code: "porcin" }
  });
  const animal = await prisma.animal.create({
    data: {
      farmId,
      speciesId: species.id,
      sex: AnimalSex.unknown,
      status: "active"
    }
  });
  return animal.id;
}

export async function setupMarketplaceDeliveryListing(params: {
  app: INestApplication;
  prisma: PrismaClient;
  sellerToken: string;
  sellerProfileId: string;
  sellerFarmId: string;
  buyerToken: string;
  buyerFarmId: string;
}): Promise<MarketplaceDeliveryCtx> {
  const animalId = await createListingAnimal(params.prisma, params.sellerFarmId);
  const listingRes = await request(params.app.getHttpServer())
    .post("/api/v1/marketplace/listings")
    .set("Authorization", `Bearer ${params.sellerToken}`)
    .set("X-Profile-Id", params.sellerProfileId)
    .send({
      title: "E2E porcelet double confirmation",
      farmId: params.sellerFarmId,
      animalId,
      category: "piglet",
      totalPrice: 75_000,
      totalWeightKg: 25
    });
  if (![200, 201].includes(listingRes.status)) {
    throw new Error(`listing create failed: ${listingRes.status} ${JSON.stringify(listingRes.body)}`);
  }
  const listingId = listingRes.body.id as string;

  const publishRes = await request(params.app.getHttpServer())
    .post(`/api/v1/marketplace/listings/${listingId}/publish`)
    .set("Authorization", `Bearer ${params.sellerToken}`)
    .set("X-Profile-Id", params.sellerProfileId)
    .send({ durationDays: 14 });
  if (![200, 201].includes(publishRes.status)) {
    throw new Error(`publish failed: ${publishRes.status}`);
  }

  const offerRes = await request(params.app.getHttpServer())
    .post(`/api/v1/marketplace/listings/${listingId}/offers`)
    .set("Authorization", `Bearer ${params.buyerToken}`)
    .send({
      offeredPrice: 75_000,
      buyerFarmId: params.buyerFarmId
    });
  if (![200, 201].includes(offerRes.status)) {
    throw new Error(`offer failed: ${offerRes.status} ${JSON.stringify(offerRes.body)}`);
  }
  const offerId = offerRes.body.id as string;

  const acceptRes = await request(params.app.getHttpServer())
    .post(
      `/api/v1/marketplace/listings/${listingId}/offers/${offerId}/accept`
    )
    .set("Authorization", `Bearer ${params.sellerToken}`)
    .set("X-Profile-Id", params.sellerProfileId);
  if (![200, 201].includes(acceptRes.status)) {
    throw new Error(`accept failed: ${acceptRes.status} ${JSON.stringify(acceptRes.body)}`);
  }
  const transactionId = acceptRes.body.transactionId as string;

  return {
    listingId,
    offerId,
    transactionId,
    animalId,
    buyerFarmId: params.buyerFarmId
  };
}

export async function runDoubleConfirmationHappyPath(params: {
  app: INestApplication;
  sellerToken: string;
  buyerToken: string;
  ctx: MarketplaceDeliveryCtx;
}): Promise<void> {
  const payInit = await request(params.app.getHttpServer())
    .post(
      `/api/v1/marketplace/transactions/${params.ctx.transactionId}/payment/initiate`
    )
    .set("Authorization", `Bearer ${params.buyerToken}`);
  expect(payInit.status).toBe(201);
  const providerRef = payInit.body.providerRef as string;

  const payConfirm = await request(params.app.getHttpServer())
    .post(
      `/api/v1/marketplace/transactions/${params.ctx.transactionId}/payment/confirm`
    )
    .set("Authorization", `Bearer ${params.buyerToken}`)
    .send({ providerRef });
  expect(payConfirm.status).toBe(201);
  expect(payConfirm.body.status).toBe("PAYMENT_HELD");

  const ship = await request(params.app.getHttpServer())
    .post(
      `/api/v1/marketplace/transactions/${params.ctx.transactionId}/confirm-shipment`
    )
    .set("Authorization", `Bearer ${params.sellerToken}`)
    .send({
      shippedAt: new Date().toISOString().slice(0, 10),
      method: "handover"
    });
  expect(ship.status).toBe(201);
  expect(ship.body.status).toBe("SELLER_SHIPPED");

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
  expect(receipt.status).toBe(201);
  expect(receipt.body.status).toBe("WEIGHT_DECLARED");

  const validate = await request(params.app.getHttpServer())
    .post(
      `/api/v1/marketplace/transactions/${params.ctx.transactionId}/weight/validate`
    )
    .set("Authorization", `Bearer ${params.sellerToken}`);
  expect(validate.status).toBe(201);
  expect(validate.body.status).toBe("TRANSACTION_CLOSED");
  expect(validate.body.pendingTransfer).toBeDefined();
  expect(validate.body.pendingTransfer.completedAt).toBeNull();
}
