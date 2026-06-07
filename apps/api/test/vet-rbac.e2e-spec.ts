import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { FARM_SCOPE } from "../src/common/farm-scopes.constants";
import { createTestApp } from "./helpers/create-test-app";
import {
  cleanupE2eVetRbacFixtures,
  seedE2eVetRbacFixtures,
  type E2EVetRbacSeedResult
} from "./helpers/e2e-vet-rbac-seed";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());

const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("RBAC vétérinaire (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2EVetRbacSeedResult;

  const year = new Date().getUTCFullYear();
  const month = new Date().getUTCMonth() + 1;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eVetRbacFixtures(PrismaClient);
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      await cleanupE2eVetRbacFixtures(ctx.prisma, {
        farmId: ctx.farmId,
        producerUserId: ctx.producerUserId,
        vetUserId: ctx.vetUserId
      });
    }
  });

  it("producteur : preview rapport expose des totaux finance non nuls", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/reports/preview`)
      .query({ periodType: "monthly", year: String(year), month: String(month) })
      .set("Authorization", `Bearer ${ctx.producerToken}`);

    expect(res.status).toBe(200);
    expect(Number(res.body?.sections?.finance?.current?.totals?.expenses)).toBeGreaterThan(
      0
    );
  });

  it("vétérinaire (scopes par défaut) : GET finance/summary → 403", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/finance/summary`)
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId);

    expect(res.status).toBe(403);
    expect(String(res.body?.message ?? "")).toContain("finance.read");
  });

  it("vétérinaire : GET activity-logs → 403", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/activity-logs`)
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId);

    expect(res.status).toBe(403);
    expect(String(res.body?.message ?? "")).toContain("audit.read");
  });

  it("vétérinaire : POST invitation → 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/invitations`)
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId)
      .send({ role: "viewer" });

    expect(res.status).toBe(403);
    expect(String(res.body?.message ?? "")).toContain("invitations.manage");
  });

  it("vétérinaire : GET members → 200 (scope chat)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/members`)
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("vétérinaire : GET health/overview → 200", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/health/overview`)
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId);

    expect(res.status).toBe(200);
    expect(res.body?.farmId).toBe(ctx.farmId);
  });

  it("vétérinaire : preview rapport sans fuite finance", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/reports/preview`)
      .query({ periodType: "monthly", year: String(year), month: String(month) })
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId);

    expect(res.status).toBe(200);
    expect(res.body?.sections?.finance?.current?.totals?.expenses).toBe("0");
    expect(res.body?.sections?.finance?.current?.totals?.revenues).toBe("0");
    expect(res.body?.sections?.health?.healthSpend).toBe("0");
    expect(res.body?.sections?.feed?.feedCost).toBe("0");
    expect(res.body?.sections?.projection?.nextMonths ?? []).toEqual([]);
  });

  it("vétérinaire : POST reports/generate → 403", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/reports/generate`)
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId)
      .send({
        periodType: "monthly",
        anchor: { year, month }
      });

    expect(res.status).toBe(403);
    expect(String(res.body?.message ?? "")).toContain("finance.read");
  });

  it("vétérinaire : POST /ai/recommendations module finance → 403", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/ai/recommendations")
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId)
      .send({ farmId: ctx.farmId, module: "finance" });

    expect(res.status).toBe(403);
    expect(String(res.body?.message ?? "")).toContain("finance.read");
  });

  it("vétérinaire : POST /ai/recommendations module sante → 200", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/ai/recommendations")
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId)
      .send({ farmId: ctx.farmId, module: "sante" });

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(typeof res.body?.generatedAt).toBe("string");
    expect(Array.isArray(res.body?.items)).toBe(true);
  });

  it("vétérinaire : GET dashboard → KPI fermes = memberships actives", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/vet-profiles/me/dashboard")
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.assignedFarms)).toBe(true);
    expect(res.body.assignedFarms.length).toBeGreaterThanOrEqual(1);
    expect(res.body.kpis?.farmsFollowed).toBeGreaterThanOrEqual(1);
    expect(res.body.stats?.farmsFollowed).toBe(res.body.kpis.farmsFollowed);
    expect(
      res.body.assignedFarms.some(
        (f: { farmId?: string; id?: string }) =>
          f.farmId === ctx.farmId || f.id === ctx.farmId
      )
    ).toBe(true);
  });

  it("vétérinaire sans vet.write : POST schedule-visit → 403", async () => {
    await ctx.prisma.farmMembership.updateMany({
      where: { farmId: ctx.farmId, userId: ctx.vetUserId },
      data: {
        scopes: [
          FARM_SCOPE.livestockRead,
          FARM_SCOPE.healthRead,
          FARM_SCOPE.healthWrite,
          FARM_SCOPE.vetRead,
          FARM_SCOPE.tasksRead,
          FARM_SCOPE.chat
        ]
      }
    });

    const scheduledAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const res = await request(app.getHttpServer())
      .post("/api/v1/vet-profiles/me/schedule-visit")
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId)
      .send({
        farmId: ctx.farmId,
        scheduledAt,
        reason: "routine",
        notes: "Visite e2e RBAC"
      });

    expect(res.status).toBe(403);
    expect(String(res.body?.message ?? "")).toContain("vet.write");

    await ctx.prisma.farmMembership.updateMany({
      where: { farmId: ctx.farmId, userId: ctx.vetUserId },
      data: { scopes: [] }
    });
  });
});

if (!hasDb || !hasJwt) {
  // eslint-disable-next-line no-console -- message utile quand la suite est ignorée
  console.info(
    "[e2e] RBAC vétérinaire ignoré : DATABASE_URL et SUPABASE_JWT_SECRET requis."
  );
}
