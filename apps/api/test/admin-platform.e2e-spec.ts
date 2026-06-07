import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import {
  attachSuperAdminToUser,
  detachSuperAdmin
} from "./helpers/e2e-admin-seed";
import {
  cleanupE2eFixtures,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());

const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Console SuperAdmin API (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let superAdminId: string;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eFixtures(PrismaClient);
    const admin = await attachSuperAdminToUser(ctx.prisma, ctx.userId);
    superAdminId = admin.superAdminId;
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      await ctx.prisma.sanitaryAlert.deleteMany({
        where: { createdBy: ctx.userId, zoneName: "Zone test e2e" }
      });
      await detachSuperAdmin(ctx.prisma, superAdminId);
      await cleanupE2eFixtures(ctx.prisma, {
        farmId: ctx.farmId,
        userId: ctx.userId,
        peerUserId: ctx.peerUserId
      });
    }
  });

  it("GET /admin/me refuse un utilisateur non SuperAdmin", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/me")
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(res.status).toBe(403);
  });

  it("GET /admin/me répond pour un SuperAdmin", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/me")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.role).toBe("superadmin");
    expect(res.body?.userId).toBe(ctx.userId);
    expect(res.body?.email).toBe("e2e-mobile-contract@fermier.local");
  });

  it("GET /admin/platform/overview expose les KPIs", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/platform/overview")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.kpis).toBeDefined();
    expect(typeof res.body.kpis.totalUsers).toBe("number");
    expect(typeof res.body.kpis.activeFarms).toBe("number");
    expect(Array.isArray(res.body.charts?.signups30d)).toBe(true);
    expect(Array.isArray(res.body.recentActivity?.signups)).toBe(true);
  });

  it("GET /admin/users liste paginée", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .query({ take: "10" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.items)).toBe(true);
    expect(typeof res.body?.total).toBe("number");
  });

  it("GET /admin/users/:id détail utilisateur seed mobile", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${ctx.userId}`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.user?.id).toBe(ctx.userId);
    expect(res.body?.livestockSummary).toBeDefined();
    expect(res.body?.financeSummary).toBeDefined();
  });

  it("GET /admin/settings crée la ligne default si absente", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/settings")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.id).toBe("default");
    expect(typeof res.body.alertCaseThreshold).toBe("number");
  });

  it("PATCH /admin/settings met à jour les seuils", async () => {
    const res = await request(app.getHttpServer())
      .patch("/api/v1/admin/settings")
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ alertCaseThreshold: 7, alertPeriodDays: 14 });
    expect(res.status).toBe(200);
    expect(res.body.alertCaseThreshold).toBe(7);
    expect(res.body.alertPeriodDays).toBe(14);
  });

  it("GET /admin/health-map et /admin/stats", async () => {
    const map = await request(app.getHttpServer())
      .get("/api/v1/admin/health-map")
      .query({ periodDays: "30" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(map.status).toBe(200);
    expect(Array.isArray(map.body?.regions)).toBe(true);
    expect(Array.isArray(map.body?.points)).toBe(true);

    const stats = await request(app.getHttpServer())
      .get("/api/v1/admin/stats")
      .query({ period: "month" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(stats.status).toBe(200);
    expect(typeof stats.body.newUsers).toBe("number");
    expect(Array.isArray(stats.body.topDiseases)).toBe(true);
  });

  it("POST /admin/sanitary-alerts crée une alerte manuelle", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/sanitary-alerts")
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        zoneName: "Zone test e2e",
        alertType: "manual",
        level: "warning",
        message: "Alerte créée par test e2e SuperAdmin"
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body?.id).toBeDefined();
    expect(res.body?.zoneName).toBe("Zone test e2e");
  });

  it("GET /admin/vet-profiles liste les dossiers", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/vet-profiles")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /admin/superadmins inclut le compte e2e", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/superadmins")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((r: { userId: string }) => r.userId === ctx.userId)).toBe(true);
  });
});
