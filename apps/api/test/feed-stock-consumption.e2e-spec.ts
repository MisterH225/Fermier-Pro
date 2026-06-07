import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import { seedE2eFixtures, type E2ESeedResult } from "./helpers/e2e-seed";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

describeOrSkip("Stock aliment — consommation avec entrées (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let feedTypeId: string;
  let entryMovementId: string;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eFixtures(PrismaClient);
    app = await createTestApp();

    const createdType = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/types`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        name: "Aliment conso e2e",
        unit: "sac",
        weightPerBagKg: 25,
        color: "#abcdef"
      });
    expect(createdType.status).toBeGreaterThanOrEqual(200);
    feedTypeId = createdType.body.id as string;

    const entry = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/movements`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        kind: "in",
        feedTypeId,
        quantityInput: 40,
        quantityUnit: "sac",
        occurredAt: daysAgo(10)
      });
    expect(entry.status).toBeGreaterThanOrEqual(200);
    expect(Number(entry.body?.movement?.stockAfterKg ?? entry.body?.stockAfterKg)).toBeCloseTo(
      1000,
      1
    );
    entryMovementId =
      (entry.body?.movement?.id as string) ?? (entry.body?.id as string);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      await ctx.prisma.feedStockMovement.deleteMany({
        where: { farmId: ctx.farmId, feedTypeId }
      });
      await ctx.prisma.feedType.deleteMany({ where: { id: feedTypeId } });
    }
  });

  it("calcule la conso moyenne dès le 1er contrôle (entrée → contrôle)", async () => {
    const check = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/movements`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        kind: "stock_check",
        feedTypeId,
        bagsCounted: 32,
        occurredAt: daysAgo(0)
      });
    expect(check.status).toBeGreaterThanOrEqual(200);
    expect(Number(check.body?.movement?.stockAfterKg ?? check.body?.stockAfterKg)).toBeCloseTo(
      800,
      1
    );

    const stats = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/feed/stats`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(stats.status).toBe(200);
    const row = (stats.body.items as Array<Record<string, unknown>>).find(
      (x) => x.feedTypeId === feedTypeId
    );
    expect(row).toBeDefined();
    expect(row?.hasSufficientData).toBe(true);
    const daily = Number.parseFloat(String(row?.avgDailyConsumptionKg ?? ""));
    expect(daily).toBeGreaterThan(0);
    // 200 kg consommés sur ~10 jours ≈ 20 kg/j
    expect(daily).toBeGreaterThanOrEqual(15);
    expect(daily).toBeLessThanOrEqual(25);
  });

  it("reflète une entrée postérieure au dernier contrôle dans le stock courant", async () => {
    const typeRes = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/types`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        name: "Aliment post-check e2e",
        unit: "sac",
        weightPerBagKg: 25,
        color: "#aabbcc"
      });
    const postCheckTypeId = typeRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/movements`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        kind: "in",
        feedTypeId: postCheckTypeId,
        quantityInput: 40,
        quantityUnit: "sac",
        occurredAt: daysAgo(15)
      });

    await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/movements`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        kind: "stock_check",
        feedTypeId: postCheckTypeId,
        bagsCounted: 32,
        occurredAt: daysAgo(10)
      });

    await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/movements`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        kind: "in",
        feedTypeId: postCheckTypeId,
        quantityInput: 4,
        quantityUnit: "sac",
        occurredAt: daysAgo(2)
      });

    const stats = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/feed/stats`)
      .set("Authorization", `Bearer ${ctx.token}`);
    const row = (stats.body.items as Array<Record<string, unknown>>).find(
      (x) => x.feedTypeId === postCheckTypeId
    );
    // Contrôle à 800 kg + entrée 100 kg = 900 kg (pas 800 figé sur le contrôle)
    expect(Number.parseFloat(String(row?.currentStockKg ?? ""))).toBeCloseTo(900, 1);
    expect(row?.percentRemaining).toBeGreaterThanOrEqual(85);

    await ctx.prisma.feedStockMovement.deleteMany({
      where: { feedTypeId: postCheckTypeId }
    });
    await ctx.prisma.feedType.delete({ where: { id: postCheckTypeId } });
  });

  it("inclut une réception entre deux contrôles dans la consommation", async () => {
    const typeRes = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/types`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        name: "Aliment intervalle e2e",
        unit: "sac",
        weightPerBagKg: 25,
        color: "#fedcba"
      });
    const intervalTypeId = typeRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/movements`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        kind: "in",
        feedTypeId: intervalTypeId,
        quantityInput: 40,
        quantityUnit: "sac",
        occurredAt: daysAgo(20)
      });

    await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/movements`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        kind: "stock_check",
        feedTypeId: intervalTypeId,
        bagsCounted: 38,
        occurredAt: daysAgo(10)
      });

    await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/movements`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        kind: "in",
        feedTypeId: intervalTypeId,
        quantityInput: 4,
        quantityUnit: "sac",
        occurredAt: daysAgo(5)
      });

    await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/movements`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        kind: "stock_check",
        feedTypeId: intervalTypeId,
        bagsCounted: 36,
        occurredAt: daysAgo(0)
      });

    const stats = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/feed/stats`)
      .set("Authorization", `Bearer ${ctx.token}`);
    const row = (stats.body.items as Array<Record<string, unknown>>).find(
      (x) => x.feedTypeId === intervalTypeId
    );
    expect(row?.hasSufficientData).toBe(true);
    const daily = Number.parseFloat(String(row?.avgDailyConsumptionKg ?? ""));
    // Intervalle 2 : (950 + 100 - 900) / 10 j = 15 kg/j
    expect(daily).toBeGreaterThanOrEqual(10);

    await ctx.prisma.feedStockMovement.deleteMany({
      where: { feedTypeId: intervalTypeId }
    });
    await ctx.prisma.feedType.delete({ where: { id: intervalTypeId } });
  });

  it("refuse les candidats de rapprochement pour un mouvement d'une autre ferme", async () => {
    const otherFarm = await ctx.prisma.farm.create({
      data: {
        name: "Ferme IDOR e2e",
        ownerId: ctx.userId
      }
    });
    try {
      const res = await request(app.getHttpServer())
        .get(
          `/api/v1/farms/${otherFarm.id}/feed/movements/${entryMovementId}/reconciliation-candidates`
        )
        .set("Authorization", `Bearer ${ctx.token}`);
      expect(res.status).toBe(404);
    } finally {
      await ctx.prisma.farm.delete({ where: { id: otherFarm.id } });
    }
  });
});
