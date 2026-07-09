import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHmac } from "crypto";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { GeniusPayClient } from "../../src/marketplace/escrow/geniuspay/geniuspay.client";
import { GeniusPayE2eMock } from "../mocks/geniuspay-e2e.mock";

export type TestAppWithGeniusPayMock = {
  app: NestExpressApplication;
  geniusPay: GeniusPayE2eMock;
};

/** App Nest de test avec GeniusPay mocké (facturation abonnement commerçant). */
export async function createTestAppWithGeniusPayMock(): Promise<TestAppWithGeniusPayMock> {
  const geniusPay = new GeniusPayE2eMock();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  })
    .overrideProvider(GeniusPayClient)
    .useValue(geniusPay)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    rawBody: true
  });
  app.set("query parser", "extended");
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );
  await app.init();
  return { app, geniusPay };
}

export function postGeniusPayWebhook(
  app: NestExpressApplication,
  payload: Record<string, unknown>,
  secret = process.env.GENIUSPAY_WEBHOOK_SECRET ?? "whsec_e2e_test"
) {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return request(app.getHttpServer())
    .post("/api/v1/webhooks/geniuspay")
    .set("x-webhook-signature", signature)
    .set("x-webhook-timestamp", timestamp)
    .set("x-webhook-event", String(payload.event ?? ""))
    .set("Content-Type", "application/json")
    .send(rawBody);
}
