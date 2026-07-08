import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
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

  const app = moduleRef.createNestApplication<NestExpressApplication>();
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
