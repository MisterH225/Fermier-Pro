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
import { RegionStatsSnapshotService } from "../src/admin-platform/region-stats-snapshot.service";
import { startOfUtcDay } from "../src/admin-platform/region-stats-date.util";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());

const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Stats régionales console (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let superAdminId: string;
  let institutionUserId: string;
  const snapshotDate = startOfUtcDay(new Date("2026-06-01T00:00:00.000Z"));
  const deptLow = "CI-AB";
  const deptHigh = "CI-BK";

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eFixtures(PrismaClient);
    const admin = await attachSuperAdminToUser(ctx.prisma, ctx.userId);
    superAdminId = admin.superAdminId;

    const institution = await attachInstitutionConsoleUser(
      ctx.prisma,
      ctx.peerUserId,
      { stats: "read" }
    );
    institutionUserId = institution.id;

    await ctx.prisma.adminRegionRef.upsert({
      where: { code: deptLow },
      create: {
        code: deptLow,
        name: "Abidjan",
        level: "department",
        parentCode: "CI-D-LG"
      },
      update: {}
    });
    await ctx.prisma.adminRegionRef.upsert({
      where: { code: deptHigh },
      create: {
        code: deptHigh,
        name: "Bouaké",
        level: "department",
        parentCode: "CI-D-VB"
      },
      update: {}
    });

    await ctx.prisma.farm.update({
      where: { id: ctx.farmId },
      data: { departmentCode: deptHigh, geoResolutionSource: "manual" }
    });

    for (let i = 0; i < 4; i += 1) {
      await ctx.prisma.farm.create({
        data: {
          name: `Ferme e2e régionale ${i}`,
          ownerId: ctx.peerUserId,
          departmentCode: deptLow,
          geoResolutionSource: "manual",
          status: "active"
        }
      });
    }

    await ctx.prisma.regionStatsDaily.createMany({
      data: [
        {
          date: snapshotDate,
          departmentCode: deptLow,
          farmCount: 4,
          mortalityHeadcount: 3,
          mortalityByCause: { infection: 3 },
          animalCountByCategory: { fattening: 20 },
          vetConsultationsCount: 1
        },
        {
          date: snapshotDate,
          departmentCode: deptHigh,
          farmCount: 6,
          mortalityHeadcount: 2,
          mortalityByCause: { accident: 2 },
          animalCountByCategory: { starter: 15 },
          vetConsultationsCount: 4
        }
      ]
    });

    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      await ctx.prisma.regionStatsDaily.deleteMany({
        where: {
          departmentCode: { in: [deptLow, deptHigh] },
          date: snapshotDate
        }
      });
      await ctx.prisma.farm.deleteMany({
        where: {
          name: { startsWith: "Ferme e2e régionale" }
        }
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

  const regionalRoutes = [
    "/api/v1/admin/stats/regional/mortality",
    "/api/v1/admin/stats/regional/herd",
    "/api/v1/admin/stats/regional/reproduction",
    "/api/v1/admin/stats/regional/growth",
    "/api/v1/admin/stats/regional/vet-coverage"
  ] as const;

  it("institution ne peut pas appeler GET /admin/stats nominatif (403)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/stats")
      .query({ period: "month" })
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(res.status).toBe(403);
  });

  it("superadmin peut appeler GET /admin/stats nominatif", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/stats")
      .query({ period: "month" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.newUsers).toBe("number");
  });

  for (const route of regionalRoutes) {
    it(`institution — k-anonymat sur ${route}`, async () => {
      const res = await request(app.getHttpServer())
        .get(route)
        .query({
          from: "2026-06-01",
          to: "2026-06-01"
        })
        .set("Authorization", `Bearer ${ctx.peerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.coverage).toMatchObject({
        farmCount: expect.any(Number),
        animalCount: expect.any(Number),
        departmentsCovered: expect.any(Number)
      });
      const low = res.body.departments.find(
        (d: { departmentCode: string }) => d.departmentCode === deptLow
      );
      const high = res.body.departments.find(
        (d: { departmentCode: string }) => d.departmentCode === deptHigh
      );
      expect(low?.masked).toBe(true);
      if (route.endsWith("/mortality")) {
        expect(low?.mortalityHeadcount).toBeUndefined();
      }
      if (route.endsWith("/herd")) {
        expect(low?.animalCountByCategory).toBeUndefined();
      }
      expect(high?.masked).not.toBe(true);
      expect(JSON.stringify(res.body)).not.toMatch(/farmId|farmName|latitude/);
    });
  }

  it("superadmin accède aux routes régionales", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/stats/regional/mortality")
      .query({ from: "2026-06-01", to: "2026-06-01" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.departments)).toBe(true);
  });

  it("snapshot service idempotent en base", async () => {
    const snapshots = app.get(RegionStatsSnapshotService);
    const day = startOfUtcDay(new Date("2026-06-02T00:00:00.000Z"));
    await snapshots.snapshotForDate(day);
    await snapshots.snapshotForDate(day);
    const rows = await ctx.prisma.regionStatsDaily.findMany({
      where: { date: day, departmentCode: deptHigh }
    });
    expect(rows.length).toBeLessThanOrEqual(1);
    await ctx.prisma.regionStatsDaily.deleteMany({
      where: { date: day, departmentCode: deptHigh }
    });
  });
});
