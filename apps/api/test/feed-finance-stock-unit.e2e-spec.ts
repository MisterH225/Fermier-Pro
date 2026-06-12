import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import { seedE2eFixtures, type E2ESeedResult } from "./helpers/e2e-seed";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Finance → stock aliment (unités sacs/kg)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let feedTypeId: string;
  let expenseId: string;
  let movementId: string;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eFixtures(PrismaClient);
    app = await createTestApp();

    const createdType = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/types`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        name: "Aliment finance sac e2e",
        unit: "sac",
        weightPerBagKg: 25,
        color: "#112233"
      });
    expect(createdType.status).toBeGreaterThanOrEqual(200);
    feedTypeId = createdType.body.id as string;

    const feedCat = await ctx.prisma.financeCategory.findFirst({
      where: { farmId: ctx.farmId, key: "feed" }
    });

    const tx = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/finance/transactions/with-stock`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        amount: 50_000,
        label: "Achat aliment sacs",
        financeCategoryId: feedCat?.id,
        recordStock: true,
        stockLines: [
          {
            feedTypeId,
            quantityInput: 10,
            quantityUnit: "sac",
            unitPrice: 5000,
            priceBasis: "sac"
          }
        ]
      });
    expect(tx.status).toBeGreaterThanOrEqual(200);
    expenseId = tx.body.expense.id as string;
    movementId = tx.body.movements[0].id as string;
    expect(Number(tx.body.movements[0].quantityKg)).toBeCloseTo(250, 1);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      await ctx.prisma.farmExpense.deleteMany({ where: { id: expenseId } });
      await ctx.prisma.feedStockMovement.deleteMany({
        where: { farmId: ctx.farmId, feedTypeId }
      });
      await ctx.prisma.feedType.deleteMany({ where: { id: feedTypeId } });
    }
  });

  it("enregistre 10 sacs en 250 kg via Finance", async () => {
    const feedType = await ctx.prisma.feedType.findUnique({
      where: { id: feedTypeId }
    });
    expect(Number(feedType?.currentStockKg)).toBeCloseTo(250, 1);

    const movement = await ctx.prisma.feedStockMovement.findUnique({
      where: { id: movementId }
    });
    expect(movement?.quantityUnit).toBe("sac");
    expect(Number(movement?.quantityInput)).toBeCloseTo(10, 1);
    expect(Number(movement?.quantityKg)).toBeCloseTo(250, 1);
  });

  it("corrige la quantité en sacs et recalcule le stock", async () => {
    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/farms/${ctx.farmId}/feed/movements/${movementId}`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        quantityInput: 8,
        quantityUnit: "sac",
        priceBasis: "sac"
      });
    expect(patch.status).toBeGreaterThanOrEqual(200);
    expect(Number(patch.body.movement.quantityKg)).toBeCloseTo(200, 1);

    const feedType = await ctx.prisma.feedType.findUnique({
      where: { id: feedTypeId }
    });
    expect(Number(feedType?.currentStockKg)).toBeCloseTo(200, 1);
  });
});
