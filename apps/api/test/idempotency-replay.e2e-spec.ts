import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import {
  cleanupE2eFixtures,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

/**
 * Contrat de la file offline (P-44) : le moteur de synchro rejoue chaque appel
 * avec le même header X-Idempotency-Key (voir mobile lib/offline/syncEngine).
 * Le serveur DOIT dédupliquer : deux POST identiques → un seul enregistrement,
 * même réponse ; deux clés différentes → deux enregistrements.
 *
 * Endpoints @Idempotent couverts : pesée animal, dépense, sortie.
 */
describeOrSkip("Idempotence — rejeu de la file offline (e2e P-44)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;

  const IDEMPOTENCY_HEADER = "X-Idempotency-Key";

  function uniqueKey(prefix: string): string {
    return `e2e-idem-${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eFixtures(PrismaClient);
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      await cleanupE2eFixtures(ctx.prisma, {
        farmId: ctx.farmId,
        userId: ctx.userId,
        peerUserId: ctx.peerUserId
      });
    }
  });

  describe("pesée animal — POST /farms/:farmId/animals/:animalId/weights", () => {
    const path = () =>
      `/api/v1/farms/${ctx.farmId}/animals/${ctx.animalId}/weights`;

    it("même clé deux fois → un seul enregistrement, même réponse", async () => {
      const note = uniqueKey("weigh-note");
      const key = uniqueKey("weigh");
      const body = { weightKg: 42.5, note };

      const first = await request(app.getHttpServer())
        .post(path())
        .set("Authorization", `Bearer ${ctx.token}`)
        .set(IDEMPOTENCY_HEADER, key)
        .send(body);
      expect([200, 201]).toContain(first.status);

      const second = await request(app.getHttpServer())
        .post(path())
        .set("Authorization", `Bearer ${ctx.token}`)
        .set(IDEMPOTENCY_HEADER, key)
        .send(body);
      expect(second.status).toBe(first.status);
      // Réponse rejouée à l'identique depuis le cache d'idempotence.
      expect(second.body).toEqual(first.body);

      const count = await ctx.prisma.animalWeight.count({
        where: { animalId: ctx.animalId, note }
      });
      expect(count).toBe(1);
    });

    it("clés différentes → deux enregistrements", async () => {
      const note = uniqueKey("weigh-note-diff");
      const body = { weightKg: 43.1, note };

      for (const key of [uniqueKey("weigh-a"), uniqueKey("weigh-b")]) {
        const res = await request(app.getHttpServer())
          .post(path())
          .set("Authorization", `Bearer ${ctx.token}`)
          .set(IDEMPOTENCY_HEADER, key)
          .send(body);
        expect([200, 201]).toContain(res.status);
      }

      const count = await ctx.prisma.animalWeight.count({
        where: { animalId: ctx.animalId, note }
      });
      expect(count).toBe(2);
    });
  });

  describe("dépense — POST /farms/:farmId/finance/transactions", () => {
    const path = () => `/api/v1/farms/${ctx.farmId}/finance/transactions`;

    it("même clé deux fois → une seule dépense, même réponse", async () => {
      const label = uniqueKey("dep-label");
      const key = uniqueKey("dep");
      const body = { type: "expense", amount: 12_000, label };

      const first = await request(app.getHttpServer())
        .post(path())
        .set("Authorization", `Bearer ${ctx.token}`)
        .set(IDEMPOTENCY_HEADER, key)
        .send(body);
      expect([200, 201]).toContain(first.status);

      const second = await request(app.getHttpServer())
        .post(path())
        .set("Authorization", `Bearer ${ctx.token}`)
        .set(IDEMPOTENCY_HEADER, key)
        .send(body);
      expect(second.status).toBe(first.status);
      expect(second.body).toEqual(first.body);

      const count = await ctx.prisma.farmExpense.count({
        where: { farmId: ctx.farmId, label }
      });
      expect(count).toBe(1);
    });

    it("clés différentes → deux dépenses", async () => {
      const label = uniqueKey("dep-label-diff");
      const body = { type: "expense", amount: 9_500, label };

      for (const key of [uniqueKey("dep-a"), uniqueKey("dep-b")]) {
        const res = await request(app.getHttpServer())
          .post(path())
          .set("Authorization", `Bearer ${ctx.token}`)
          .set(IDEMPOTENCY_HEADER, key)
          .send(body);
        expect([200, 201]).toContain(res.status);
      }

      const count = await ctx.prisma.farmExpense.count({
        where: { farmId: ctx.farmId, label }
      });
      expect(count).toBe(2);
    });
  });

  describe("sortie — POST /farms/:farmId/exits", () => {
    const path = () => `/api/v1/farms/${ctx.farmId}/exits`;

    it("même clé deux fois → une seule sortie, même réponse", async () => {
      const buyerName = uniqueKey("exit-buyer");
      const key = uniqueKey("exit");
      const body = {
        kind: "sale",
        batchId: ctx.batchId,
        headcountAffected: 1,
        occurredAt: new Date().toISOString().slice(0, 10),
        buyerName,
        price: 30_000
      };

      const first = await request(app.getHttpServer())
        .post(path())
        .set("Authorization", `Bearer ${ctx.token}`)
        .set(IDEMPOTENCY_HEADER, key)
        .send(body);
      expect([200, 201]).toContain(first.status);

      const second = await request(app.getHttpServer())
        .post(path())
        .set("Authorization", `Bearer ${ctx.token}`)
        .set(IDEMPOTENCY_HEADER, key)
        .send(body);
      expect(second.status).toBe(first.status);
      expect(second.body).toEqual(first.body);

      const count = await ctx.prisma.livestockExit.count({
        where: { batchId: ctx.batchId, buyerName }
      });
      expect(count).toBe(1);
    });

    it("clés différentes → deux sorties", async () => {
      const buyerName = uniqueKey("exit-buyer-diff");
      const body = {
        kind: "sale",
        batchId: ctx.batchId,
        headcountAffected: 1,
        occurredAt: new Date().toISOString().slice(0, 10),
        buyerName,
        price: 15_000
      };

      for (const key of [uniqueKey("exit-a"), uniqueKey("exit-b")]) {
        const res = await request(app.getHttpServer())
          .post(path())
          .set("Authorization", `Bearer ${ctx.token}`)
          .set(IDEMPOTENCY_HEADER, key)
          .send(body);
        expect([200, 201]).toContain(res.status);
      }

      const count = await ctx.prisma.livestockExit.count({
        where: { batchId: ctx.batchId, buyerName }
      });
      expect(count).toBe(2);
    });
  });
});
