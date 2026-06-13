import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient, ProfileType } from "@prisma/client";
import * as jwt from "jsonwebtoken";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());

const E2E_DELETE_ACCOUNT_SUB = "77777777-7777-7777-7777-777777777777";

const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Suppression de compte (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let userId: string;
  let farmId: string;
  let token: string;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    prisma = new PrismaClient();
    app = await createTestApp();

    const secret = process.env.SUPABASE_JWT_SECRET!.trim();

    await prisma.user.deleteMany({
      where: { supabaseUserId: E2E_DELETE_ACCOUNT_SUB }
    });

    await prisma.species.upsert({
      where: { code: "porcin" },
      create: { code: "porcin", name: "Porcin", sortOrder: 0 },
      update: {}
    });

    const user = await prisma.user.create({
      data: {
        supabaseUserId: E2E_DELETE_ACCOUNT_SUB,
        email: "e2e-delete-account@fermier.local",
        fullName: "E2E Delete Account"
      }
    });
    userId = user.id;

    await prisma.profile.create({
      data: {
        userId,
        type: ProfileType.producer,
        displayName: "E2E Delete",
        isDefault: true
      }
    });

    const farm = await prisma.farm.create({
      data: {
        ownerId: userId,
        name: "Ferme suppression compte e2e",
        speciesFocus: "porcin",
        livestockMode: "batch"
      }
    });
    farmId = farm.id;

    token = jwt.sign(
      {
        sub: E2E_DELETE_ACCOUNT_SUB,
        email: "e2e-delete-account@fermier.local",
        role: "authenticated"
      },
      secret,
      { expiresIn: "2h", algorithm: "HS256" }
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.auditLog.deleteMany({
        where: { OR: [{ farmId }, { actorUserId: userId }] }
      });
      await prisma.farm.deleteMany({ where: { id: farmId } }).catch(() => undefined);
      await prisma.profile.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
      await prisma.$disconnect();
    }
  });

  it("DELETE /auth/me/account supprime le compte et la ferme possédée", async () => {
    const res = await request(app.getHttpServer())
      .delete("/api/v1/auth/me/account")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user).toBeNull();

    const farm = await prisma.farm.findUnique({ where: { id: farmId } });
    expect(farm).toBeNull();
  });
});
