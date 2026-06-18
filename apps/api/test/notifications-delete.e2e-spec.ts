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

describeOrSkip("Notifications delete (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let adminMessageId: string;
  let smartAlertId: string;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eFixtures(PrismaClient);
    await attachSuperAdminToUser(ctx.prisma, ctx.userId);
    app = await createTestApp();

    const adminRow = await ctx.prisma.adminMessage.create({
      data: {
        adminUserId: ctx.userId,
        recipientUserId: ctx.userId,
        subject: "Test notification e2e",
        message: "Message à supprimer"
      }
    });
    adminMessageId = adminRow.id;

    const alertRow = await ctx.prisma.smartAlert.create({
      data: {
        farmId: ctx.farmId,
        ruleKey: "e2e-test-alert",
        module: "health",
        priority: "warning",
        title: "Alerte test e2e",
        message: "À supprimer",
        actionRoute: null
      }
    });
    smartAlertId = alertRow.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      await ctx.prisma.adminMessage.deleteMany({
        where: { recipientUserId: ctx.userId, subject: "Test notification e2e" }
      });
      await ctx.prisma.smartAlert.deleteMany({
        where: { farmId: ctx.farmId, ruleKey: "e2e-test-alert" }
      });
      await cleanupE2eFixtures(ctx.prisma, {
        farmId: ctx.farmId,
        userId: ctx.userId,
        peerUserId: ctx.peerUserId
      });
    }
  });

  it("DELETE /auth/me/admin-messages/:id supprime un message admin", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/auth/me/admin-messages/${adminMessageId}`)
      .set("Authorization", `Bearer ${ctx.token}`);

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);

    const row = await ctx.prisma.adminMessage.findUnique({
      where: { id: adminMessageId }
    });
    expect(row).toBeNull();
  });

  it("DELETE /farms/:farmId/alerts/:id supprime une alerte", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/farms/${ctx.farmId}/alerts/${smartAlertId}`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);

    const row = await ctx.prisma.smartAlert.findUnique({
      where: { id: smartAlertId }
    });
    expect(row).toBeNull();
  });
});
