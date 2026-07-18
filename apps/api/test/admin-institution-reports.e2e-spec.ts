import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import {
  attachSuperAdminToUser,
  detachSuperAdmin
} from "./helpers/e2e-admin-seed";
import {
  attachInstitutionConsoleUser,
  detachInstitutionConsoleUser
} from "./helpers/e2e-institution-seed";
import {
  cleanupE2eFixtures,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";
import { startOfUtcDay } from "../src/admin-platform/region-stats-date.util";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Rapports stats institution (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let superAdminId: string;
  let institutionUserId: string;
  const snapshotDate = startOfUtcDay(new Date("2026-06-01T00:00:00.000Z"));
  const deptHigh = "CI-BK";

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eFixtures(PrismaClient);
    const admin = await attachSuperAdminToUser(ctx.prisma, ctx.userId);
    superAdminId = admin.superAdminId;

    const institution = await attachInstitutionConsoleUser(
      ctx.prisma,
      ctx.peerUserId,
      // POST /stats/reports est classé write par AdminConsoleMenuGuard
      { stats: "write" },
      { mortality: true }
    );
    institutionUserId = institution.id;

    await ctx.prisma.regionStatsDaily.create({
      data: {
        date: snapshotDate,
        departmentCode: deptHigh,
        farmCount: 6,
        mortalityHeadcount: 2,
        mortalityByCause: { accident: 2 },
        animalCountByCategory: { starter: 15 },
        vetConsultationsCount: 4
      }
    });

    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      await ctx.prisma.regionStatsDaily.deleteMany({
        where: { departmentCode: deptHigh, date: snapshotDate }
      });
      await detachInstitutionConsoleUser(ctx.prisma, institutionUserId);
      await detachSuperAdmin(ctx.prisma, superAdminId);
      await cleanupE2eFixtures(ctx.prisma, {
        farmId: ctx.farmId,
        userId: ctx.userId,
        peerUserId: ctx.peerUserId
      });
    }
  });

  it("institution — rapport limité à ses sections (herd refusé)", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/stats/reports")
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        sections: ["mortality", "herd"],
        from: "2026-06-01",
        to: "2026-06-01",
        format: "pdf"
      });
    expect(res.status).toBe(403);
  });

  it("institution — PDF généré sans champ nominatif", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/stats/reports")
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        sections: ["mortality"],
        from: "2026-06-01",
        to: "2026-06-01",
        format: "pdf"
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.body.toString("utf8")).not.toMatch(/farmId|farmName/);
  });

  it("superadmin — rapport complet multi-sections", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/stats/reports")
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        sections: ["mortality", "herd"],
        from: "2026-06-01",
        to: "2026-06-01",
        format: "pdf"
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("viewAsInstitutionId reproduit le périmètre (herd 403)", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/stats/reports")
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        sections: ["herd"],
        from: "2026-06-01",
        to: "2026-06-01",
        format: "pdf",
        viewAsInstitutionId: institutionUserId
      });
    expect(res.status).toBe(403);
  });

  it("viewAsInstitutionId — mortality autorisé", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/stats/reports")
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        sections: ["mortality"],
        from: "2026-06-01",
        to: "2026-06-01",
        format: "csv",
        viewAsInstitutionId: institutionUserId
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/zip");
  });

  it("viewAsInstitutionId refusé à une institution (403)", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/stats/reports")
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({
        sections: ["mortality"],
        from: "2026-06-01",
        to: "2026-06-01",
        format: "pdf",
        viewAsInstitutionId: institutionUserId
      });
    expect(res.status).toBe(403);
  });
});
