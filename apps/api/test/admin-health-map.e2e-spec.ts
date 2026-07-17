import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  FarmDiseaseCaseStatus,
  FarmHealthEntityType,
  FarmHealthRecordKind,
  PrismaClient
} from "@prisma/client";
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

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());

const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Carte sanitaire console (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let superAdminId: string;
  let institutionUserId: string;
  const deptLow = "CI-DEP-ANYAMA";
  const deptHigh = "CI-DEP-ADZOPE";
  const farmIds: string[] = [];
  const recordIds: string[] = [];

  async function seedDiseaseCase(
    farmId: string,
    diagnosis: string,
    lat: number,
    lng: number
  ) {
    const record = await ctx.prisma.farmHealthRecord.create({
      data: {
        farmId,
        kind: FarmHealthRecordKind.disease,
        entityType: FarmHealthEntityType.group,
        entityId: ctx.batchId,
        recordedByUserId: ctx.userId,
        occurredAt: new Date(),
        disease: {
          create: {
            diagnosis,
            caseStatus: FarmDiseaseCaseStatus.active
          }
        }
      }
    });
    recordIds.push(record.id);
    await ctx.prisma.farm.update({
      where: { id: farmId },
      data: {
        latitude: lat,
        longitude: lng,
        address: `Zone test, Abidjan, Côte d'Ivoire`
      }
    });
  }

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eFixtures(PrismaClient);
    const admin = await attachSuperAdminToUser(ctx.prisma, ctx.userId);
    superAdminId = admin.superAdminId;

    const institution = await attachInstitutionConsoleUser(
      ctx.prisma,
      ctx.peerUserId,
      { map: "read" }
    );
    institutionUserId = institution.id;

    await ctx.prisma.adminRegionRef.upsert({
      where: { code: "CI-R-AB" },
      create: {
        code: "CI-R-AB",
        name: "Abidjan",
        level: "region",
        parentCode: "CI-D-LG"
      },
      update: {}
    });
    await ctx.prisma.adminRegionRef.upsert({
      where: { code: deptLow },
      create: {
        code: deptLow,
        name: "Anyama",
        level: "department",
        parentCode: "CI-R-AB"
      },
      update: {}
    });
    await ctx.prisma.adminRegionRef.upsert({
      where: { code: deptHigh },
      create: {
        code: deptHigh,
        name: "Adzopé",
        level: "department",
        parentCode: "CI-R-LA"
      },
      update: {}
    });
    await ctx.prisma.adminRegionRef.upsert({
      where: { code: "CI-R-LA" },
      create: {
        code: "CI-R-LA",
        name: "La Mé",
        level: "region",
        parentCode: "CI-D-LG"
      },
      update: {}
    });

    await ctx.prisma.farm.update({
      where: { id: ctx.farmId },
      data: {
        departmentCode: deptHigh,
        geoResolutionSource: "manual"
      }
    });
    farmIds.push(ctx.farmId);
    await seedDiseaseCase(ctx.farmId, "Rouget", 6.1, -3.85);

    for (let i = 0; i < 4; i += 1) {
      const farm = await ctx.prisma.farm.create({
        data: {
          name: `Ferme e2e carte ${i}`,
          ownerId: ctx.peerUserId,
          departmentCode: deptLow,
          geoResolutionSource: "manual",
          status: "active"
        }
      });
      farmIds.push(farm.id);
      await seedDiseaseCase(farm.id, "PPC", 5.49 + i * 0.001, -4.05);
    }

    for (let i = 0; i < 4; i += 1) {
      const farm = await ctx.prisma.farm.create({
        data: {
          name: `Ferme e2e carte haute ${i}`,
          ownerId: ctx.peerUserId,
          departmentCode: deptHigh,
          geoResolutionSource: "manual",
          status: "active"
        }
      });
      farmIds.push(farm.id);
      await seedDiseaseCase(farm.id, "SDRP", 6.12 + i * 0.001, -3.86);
    }

    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (ctx?.prisma) {
      if (recordIds.length) {
        await ctx.prisma.healthDiseaseDetail.deleteMany({
          where: { healthRecordId: { in: recordIds } }
        });
        await ctx.prisma.farmHealthRecord.deleteMany({
          where: { id: { in: recordIds } }
        });
      }
      await ctx.prisma.farm.deleteMany({
        where: {
          OR: [
            { name: { startsWith: "Ferme e2e carte" } },
            { id: { in: farmIds.filter((id) => id !== ctx.farmId) } }
          ]
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

  it("superadmin obtient la sortie détaillée (points nominatifs)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/health-map")
      .query({ periodDays: "30", granularity: "sector" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body.mode).toBeUndefined();
    expect(Array.isArray(res.body.points)).toBe(true);
    expect(Array.isArray(res.body.zones)).toBe(true);
    expect(Array.isArray(res.body.regions)).toBe(true);
    if (res.body.points.length > 0) {
      expect(res.body.points[0]).toHaveProperty("farmName");
      expect(res.body.points[0]).toHaveProperty("farmId");
    }
  });

  it("superadmin peut demander le mode agrégé via query", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/health-map")
      .query({ periodDays: "30", mode: "aggregated" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("aggregated");
    expect(res.body.points).toBeUndefined();
    expect(res.body.regions).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/farmId|farmName|latitude/);
  });

  it("institution obtient l'agrégé sans champ nominatif", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/health-map")
      .query({ periodDays: "30", granularity: "department" })
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("aggregated");
    expect(res.body.granularity).toBe("department");
    expect(res.body.points).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(
      /farmId|farmName|"address"|"latitude"|"longitude"/
    );
    const zones = res.body.zones as Array<Record<string, unknown>>;
    expect(zones.some((z) => z.zoneId === `department:${deptLow}`)).toBe(true);
    const low = zones.find((z) => z.zoneId === `department:${deptLow}`);
    const high = zones.find((z) => z.zoneId === `department:${deptHigh}`);
    expect(low?.masked).toBe(true);
    expect(low?.casesCount).toBeUndefined();
    expect(high?.masked).not.toBe(true);
    expect(high?.farmsAffectedCount).toBeGreaterThanOrEqual(5);
    expect(high?.dominantDiagnoses).toBeDefined();
    expect(high?.centerLat).toBeDefined();
    expect(high?.centerLng).toBeDefined();
  });

  it("granularité department regroupe par departmentCode", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/health-map")
      .query({ periodDays: "30", granularity: "department", mode: "aggregated" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    const zone = (res.body.zones as Array<{ zoneId: string; label: string; level: string }>).find(
      (z) => z.zoneId === `department:${deptLow}`
    );
    expect(zone).toBeDefined();
    expect(zone?.level).toBe("department");
    expect(zone?.label).toContain("Anyama");
  });

  it("institution accède aux alertes sanitaires de zone", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/sanitary-alerts")
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/farmId|farmName/);
  });
});
