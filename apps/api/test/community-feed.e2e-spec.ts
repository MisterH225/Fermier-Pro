import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createTestApp } from "./helpers/create-test-app";
import {
  cleanupE2eFixtures,
  seedE2eFixtures,
  type E2ESeedResult
} from "./helpers/e2e-seed";
import {
  attachSuperAdminToUser,
  detachSuperAdmin
} from "./helpers/e2e-admin-seed";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const hasJwt = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());
const describeOrSkip = hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Community Feed (e2e)", () => {
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
      if (superAdminId) {
        await detachSuperAdmin(ctx.prisma, superAdminId);
      }
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

  it("POST /feed/comments bloque une insulte sans accent", async () => {
    const postRes = await request(app.getHttpServer())
      .post("/api/v1/feed/posts")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        postType: "question",
        body: "Question test modération commentaire e2e"
      });

    expect(postRes.status).toBeGreaterThanOrEqual(200);
    expect(postRes.status).toBeLessThan(300);

    const res = await request(app.getHttpServer())
      .post("/api/v1/feed/comments")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        postId: postRes.body.id,
        body: "Imbecile tu es trop bete"
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("POST /feed/moderate/pre-check bloque imbecile sans accent", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/feed/moderate/pre-check")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        body: "Imbecile tu es trop bête"
      });

    expect(res.status).toBe(201);
    expect(res.body?.shouldBlock).toBe(true);
    expect(res.body?.allowed).toBe(false);
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

  it("GET /feed/posts?page=1 retourne la liste paginée", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/feed/posts?page=1")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.items)).toBe(true);
    expect(res.body?.page).toBe(1);
  });

  it("POST /feed/posts/:id/like bascule le j'aime", async () => {
    const postRes = await request(app.getHttpServer())
      .post("/api/v1/feed/posts")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        postType: "tip",
        body: "Publication test like e2e feed communautaire."
      });

    expect(postRes.status).toBeGreaterThanOrEqual(200);
    expect(postRes.status).toBeLessThan(300);

    const likeRes = await request(app.getHttpServer())
      .post(`/api/v1/feed/posts/${postRes.body.id}/like`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);

    expect(likeRes.status).toBe(201);
    expect(likeRes.body?.liked).toBe(true);
    expect(likeRes.body?.likeCount).toBe(1);

    const unlikeRes = await request(app.getHttpServer())
      .post(`/api/v1/feed/posts/${postRes.body.id}/like`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);

    expect(unlikeRes.status).toBe(201);
    expect(unlikeRes.body?.liked).toBe(false);
    expect(unlikeRes.body?.likeCount).toBe(0);
  });

  it("POST /feed/comments avec parentCommentId crée une réponse", async () => {
    const postRes = await request(app.getHttpServer())
      .post("/api/v1/feed/posts")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        postType: "question",
        body: "Question parent pour réponse imbriquée e2e."
      });

    const parentRes = await request(app.getHttpServer())
      .post("/api/v1/feed/comments")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        postId: postRes.body.id,
        body: "Commentaire parent e2e."
      });

    expect(parentRes.status).toBeGreaterThanOrEqual(200);
    expect(parentRes.status).toBeLessThan(300);

    const replyRes = await request(app.getHttpServer())
      .post("/api/v1/feed/comments")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        postId: postRes.body.id,
        parentCommentId: parentRes.body.id,
        body: "Réponse au commentaire parent e2e."
      });

    expect(replyRes.status).toBeGreaterThanOrEqual(200);
    expect(replyRes.status).toBeLessThan(300);
    expect(replyRes.body?.parentCommentId).toBe(parentRes.body.id);

    const listRes = await request(app.getHttpServer())
      .get("/api/v1/feed/posts?page=1")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);

    const post = (listRes.body.items as Array<{ id: string; comments: Array<{ id: string; replies: Array<{ id: string }> }> }>).find(
      (p) => p.id === postRes.body.id
    );
    expect(post?.comments?.[0]?.replies?.[0]?.id).toBe(replyRes.body.id);
  });

  it("DELETE /admin/feed/posts/:id supprime une publication", async () => {
    const postRes = await request(app.getHttpServer())
      .post("/api/v1/feed/posts")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        postType: "observation",
        body: "Publication à supprimer par admin e2e."
      });

    const delRes = await request(app.getHttpServer())
      .delete(`/api/v1/admin/feed/posts/${postRes.body.id}`)
      .set("Authorization", `Bearer ${ctx.token}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body?.ok).toBe(true);

    const listRes = await request(app.getHttpServer())
      .get("/api/v1/feed/posts?page=1")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);

    const visible = (listRes.body.items as Array<{ id: string }>).some(
      (p) => p.id === postRes.body.id
    );
    expect(visible).toBe(false);
  });
});
