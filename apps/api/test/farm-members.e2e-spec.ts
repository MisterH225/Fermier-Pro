import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import {
  cleanupE2eVetRbacFixtures,
  seedE2eVetRbacFixtures,
  type E2EVetRbacSeedResult
} from "./helpers/e2e-vet-rbac-seed";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());

const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Membres ferme — révocation (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2EVetRbacSeedResult;
  let vetMembershipId: string;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eVetRbacFixtures(PrismaClient);
    app = await createTestApp();

    const membership = await ctx.prisma.farmMembership.findFirstOrThrow({
      where: { farmId: ctx.farmId, userId: ctx.vetUserId },
      select: { id: true }
    });
    vetMembershipId = membership.id;
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

  it("collaborateur sans invitations.manage ne peut pas révoquer un autre membre", async () => {
    const workerUser = await ctx.prisma.user.create({
      data: {
        supabaseUserId: "66666666-6666-6666-6666-666666666666",
        email: "e2e-farm-member-worker@fermier.local",
        fullName: "E2E Worker Révocation"
      }
    });

    await ctx.prisma.farmMembership.create({
      data: {
        farmId: ctx.farmId,
        userId: workerUser.id,
        role: "worker",
        scopes: []
      }
    });

    const workerToken = (
      await import("jsonwebtoken")
    ).default.sign(
      {
        sub: "66666666-6666-6666-6666-666666666666",
        email: "e2e-farm-member-worker@fermier.local",
        role: "authenticated"
      },
      process.env.SUPABASE_JWT_SECRET!.trim(),
      { expiresIn: "2h", algorithm: "HS256" }
    );

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/farms/${ctx.farmId}/members/${vetMembershipId}`)
      .set("Authorization", `Bearer ${workerToken}`);

    expect(res.status).toBe(403);

    await ctx.prisma.farmMembership.deleteMany({
      where: { farmId: ctx.farmId, userId: workerUser.id }
    });
    await ctx.prisma.user.delete({ where: { id: workerUser.id } });
  });

  it("producteur révoque un collaborateur → membre retiré de la liste", async () => {
    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/v1/farms/${ctx.farmId}/members/${vetMembershipId}`)
      .set("Authorization", `Bearer ${ctx.producerToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body?.ok).toBe(true);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/members`)
      .set("Authorization", `Bearer ${ctx.producerToken}`);

    expect(listRes.status).toBe(200);
    const ids = (listRes.body as { id: string }[]).map((m) => m.id);
    expect(ids).not.toContain(vetMembershipId);

    const vetAccessRes = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/health/overview`)
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId);

    expect(vetAccessRes.status).toBe(403);
  });

  it("révocation idempotente → 200 si le membre est déjà absent", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/farms/${ctx.farmId}/members/${vetMembershipId}`)
      .set("Authorization", `Bearer ${ctx.producerToken}`);

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
  });

});

if (!hasDb || !hasJwt) {
  // eslint-disable-next-line no-console -- message utile quand la suite est ignorée
  console.info(
    "[e2e] Révocation membres ignorée : DATABASE_URL et SUPABASE_JWT_SECRET requis."
  );
}
