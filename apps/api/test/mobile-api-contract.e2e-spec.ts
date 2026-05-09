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

const describeOrSkip =
  hasDb && hasJwt ? describe : describe.skip;

describeOrSkip("Contrat API mobile (e2e)", () => {
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
        userId: ctx.userId
      });
    }
  });

  it("GET /health répond", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/health");
    expect(res.status).toBe(200);
  });

  it("GET /auth/me (session Supabase)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.user?.email).toBe("e2e-mobile-contract@fermier.local");
  });

  it("GET /auth/me avec X-Profile-Id producteur", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);
    expect(res.status).toBe(200);
    expect(res.body?.activeProfile?.id).toBe(ctx.producerProfileId);
    expect(res.body?.activeProfile?.type).toBe("producer");
  });

  it("GET /farms liste", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/farms")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((f: { id: string }) => f.id === ctx.farmId)).toBe(
      true
    );
  });

  it("GET /farms/:id détail", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(ctx.farmId);
    expect(res.body?.name).toBeDefined();
  });

  it("POST /farms création (profil producteur)", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/farms")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        name: "Ferme e2e création jetable",
        speciesFocus: "porcin",
        livestockMode: "batch"
      });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    const newId = res.body?.id as string;
    expect(newId).toBeDefined();

    await ctx.prisma.auditLog.deleteMany({ where: { farmId: newId } });
    await ctx.prisma.farm.delete({ where: { id: newId } });
  });

  it("GET liste animaux + liste lots", async () => {
    const animals = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/animals`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(animals.status).toBe(200);
    expect(
      animals.body.some((a: { id: string }) => a.id === ctx.animalId)
    ).toBe(true);

    const batches = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/batches`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(batches.status).toBe(200);
    expect(
      batches.body.some((b: { id: string }) => b.id === ctx.batchId)
    ).toBe(true);
  });

  it("GET détail animal", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/animals/${ctx.animalId}`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(ctx.animalId);
    expect(Array.isArray(res.body?.weights)).toBe(true);
  });

  it("POST pesée animal (livestockWrite)", async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/api/v1/farms/${ctx.farmId}/animals/${ctx.animalId}/weights`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ weightKg: 72.25, note: "Pesée e2e animal" });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
  });

  it("GET puis POST événement santé animal (healthRead / healthWrite)", async () => {
    const list = await request(app.getHttpServer())
      .get(
        `/api/v1/farms/${ctx.farmId}/animals/${ctx.animalId}/health-events`
      )
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);

    const post = await request(app.getHttpServer())
      .post(
        `/api/v1/farms/${ctx.farmId}/animals/${ctx.animalId}/health-events`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        severity: "watch",
        title: "Surveillance e2e",
        body: "Test contrat santé individuel"
      });
    expect(post.status).toBeGreaterThanOrEqual(200);
    expect(post.status).toBeLessThan(300);
    expect(post.body?.title).toBe("Surveillance e2e");
  });

  it("GET liste des tâches + filtre status (tasksRead)", async () => {
    const all = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/tasks`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(all.status).toBe(200);
    expect(Array.isArray(all.body)).toBe(true);

    const todo = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/tasks`)
      .query({ status: "todo" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(todo.status).toBe(200);
    expect(Array.isArray(todo.body)).toBe(true);
  });

  it("POST puis PATCH tâche (tasksWrite)", async () => {
    const post = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/tasks`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ title: "Tâche contrat e2e", priority: "normal" });
    expect(post.status).toBeGreaterThanOrEqual(200);
    expect(post.status).toBeLessThan(300);
    expect(post.body?.id).toBeDefined();

    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/farms/${ctx.farmId}/tasks/${post.body.id}`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ status: "done" });
    expect(patch.status).toBeGreaterThanOrEqual(200);
    expect(patch.status).toBeLessThan(300);
    expect(patch.body?.status).toBe("done");
  });

  it("GET détail lot + pesées (livestockRead)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/batches/${ctx.batchId}`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(ctx.batchId);
    expect(Array.isArray(res.body?.weights)).toBe(true);
  });

  it("POST pesée lot (livestockWrite)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/batches/${ctx.batchId}/weights`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        avgWeightKg: 85.5,
        headcountSnapshot: 40,
        note: "Pesée e2e"
      });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
  });

  it("GET puis POST événement santé lot (healthRead / healthWrite)", async () => {
    const list = await request(app.getHttpServer())
      .get(
        `/api/v1/farms/${ctx.farmId}/batches/${ctx.batchId}/health-events`
      )
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);

    const post = await request(app.getHttpServer())
      .post(
        `/api/v1/farms/${ctx.farmId}/batches/${ctx.batchId}/health-events`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        severity: "info",
        title: "Visite e2e",
        body: "Contrôle sanitaire automatisé"
      });
    expect(post.status).toBeGreaterThanOrEqual(200);
    expect(post.status).toBeLessThan(300);
    expect(post.body?.title).toBe("Visite e2e");
  });
});

if (!hasDb || !hasJwt) {
  // eslint-disable-next-line no-console -- message utile quand la suite est ignorée
  console.info(
    "[e2e] Ignoré : renseigner DATABASE_URL (ex. chaîne Supabase → Database) et SUPABASE_JWT_SECRET (Settings → API). Voir docs/SETUP.md, section Tests e2e."
  );
}
