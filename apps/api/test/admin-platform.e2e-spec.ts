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
    expect(res.body).toHaveProperty("supportPhone");
    expect(res.body).toHaveProperty("supportTelegramUrl");
    expect(res.body.supportEffective).toBeDefined();
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

  it("PATCH /admin/settings met à jour le contact support", async () => {
    const res = await request(app.getHttpServer())
      .patch("/api/v1/admin/settings")
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        supportPhone: "+221771234567",
        supportTelegramUrl: "@fermierpro_test"
      });
    expect(res.status).toBe(200);
    expect(res.body.supportPhone).toBe("+221771234567");
    expect(res.body.supportTelegramUrl).toBe("https://t.me/fermierpro_test");
    expect(res.body.supportEffective.phone).toBe("+221771234567");
    expect(res.body.supportEffective.telegramUrl).toBe(
      "https://t.me/fermierpro_test"
    );
  });

  it("GET /admin/health-map et /admin/stats", async () => {
    const map = await request(app.getHttpServer())
      .get("/api/v1/admin/health-map")
      .query({ periodDays: "30" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(map.status).toBe(200);
    expect(Array.isArray(map.body?.regions)).toBe(true);
    expect(Array.isArray(map.body?.zones)).toBe(true);
    expect(Array.isArray(map.body?.points)).toBe(true);
    expect(map.body?.granularity).toBeDefined();

    const mapSector = await request(app.getHttpServer())
      .get("/api/v1/admin/health-map")
      .query({ periodDays: "30", granularity: "sector" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(mapSector.status).toBe(200);
    expect(mapSector.body.granularity).toBe("sector");

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
    expect(res.body[0]).toMatchObject({
      id: expect.any(String),
      userId: expect.any(String),
      email: expect.any(String),
      createdAt: expect.any(String)
    });
  });

  it("POST /admin/superadmins refuse un mot de passe trop court", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/superadmins")
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        email: "new-admin-e2e@fermier.local",
        password: "short"
      });
    expect(res.status).toBe(400);
  });

  it("POST /admin/superadmins refuse un email déjà administrateur", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/superadmins")
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        email: "e2e-mobile-contract@fermier.local",
        password: "ValidPass12345"
      });
    expect(res.status).toBe(409);
  });

  it("DELETE /admin/superadmins/:userId refuse l'auto-suppression", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/superadmins/${ctx.userId}`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(403);
  });

  it("modération: avertir, suspendre, lever suspension", async () => {
    const warn = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${ctx.peerUserId}/warn`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        motive: "Test e2e",
        message: "Premier avertissement test.",
        warningLevel: "1er avertissement",
        notifyUser: false
      });
    expect(warn.status).toBe(201);

    const suspend = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${ctx.peerUserId}/suspend`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        scope: "account",
        reason: "Test e2e suspension",
        duration: "Indéfinie",
        notifyUser: false
      });
    expect(suspend.status).toBe(200);

    const meSuspended = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(meSuspended.status).toBe(200);
    expect(meSuspended.body.user.accountStatus).toBe("suspended");

    const unsuspend = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${ctx.peerUserId}/unsuspend`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ scope: "account", notifyUser: false });
    expect(unsuspend.status).toBe(200);

    const meActive = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(meActive.status).toBe(200);
    expect(meActive.body.user.accountStatus).toBe("active");
  });

  it("modération: bannir puis débannir", async () => {
    const ban = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${ctx.peerUserId}/ban`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        scope: "account",
        reason: "Test e2e ban",
        details: "Détails test bannissement",
        notifyUser: false
      });
    expect(ban.status).toBe(200);

    const meBanned = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(meBanned.status).toBe(200);
    expect(meBanned.body.user.accountStatus).toBe("banned");

    const unban = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${ctx.peerUserId}/unban`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ scope: "account", notifyUser: false });
    expect(unban.status).toBe(200);

    const meActive = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(meActive.status).toBe(200);
    expect(meActive.body.user.accountStatus).toBe("active");
  });

  it("POST /admin/messages puis lecture mobile /auth/me/admin-messages", async () => {
    const send = await request(app.getHttpServer())
      .post("/api/v1/admin/messages")
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        userId: ctx.peerUserId,
        subject: "Message test e2e",
        message: "Contenu du message admin pour l'utilisateur mobile.",
        type: "info",
        sendPush: false
      });
    expect([200, 201]).toContain(send.status);
    expect(send.body?.messageId).toBeDefined();

    const unread = await request(app.getHttpServer())
      .get("/api/v1/auth/me/admin-messages/unread-count")
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(unread.status).toBe(200);
    expect(unread.body.count).toBeGreaterThanOrEqual(1);

    const list = await request(app.getHttpServer())
      .get("/api/v1/auth/me/admin-messages")
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body?.items)).toBe(true);
    const row = list.body.items.find(
      (m: { id: string }) => m.id === send.body.messageId
    );
    expect(row).toBeDefined();
    expect(row.subject).toBe("Message test e2e");
    expect(row.isRead).toBe(false);

    const read = await request(app.getHttpServer())
      .patch(`/api/v1/auth/me/admin-messages/${send.body.messageId}/read`)
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(read.status).toBe(200);
    expect(read.body.ok).toBe(true);
  });
});
