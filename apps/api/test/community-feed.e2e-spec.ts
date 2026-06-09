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

describeOrSkip("Community Feed (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;

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

  it("GET /feed/rules retourne les règles communautaires", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/feed/rules")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.rules)).toBe(true);
    expect(res.body.rules.length).toBeGreaterThanOrEqual(7);
  });

  it("POST /feed/posts bloque une insulte", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/feed/posts")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        postType: "question",
        body: "Tu es un idiot complet"
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("POST /feed/posts accepte un contenu normal", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/feed/posts")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        postType: "tip",
        body: "Bon complément minéral pour les porcelets en post-sevrage cette semaine."
      });

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body?.id).toBeTruthy();
    expect(res.body?.body).toContain("complément minéral");
  });

  it("GET /feed/my-status retourne le statut actif", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/feed/my-status")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);

    expect(res.status).toBe(200);
    expect(res.body?.feedStatus).toBe("active");
    expect(res.body?.canPost).toBe(true);
  });
});
