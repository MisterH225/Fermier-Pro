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
        userId: ctx.userId,
        peerUserId: ctx.peerUserId
      });
    }
  });

  it("GET /health répond", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/health");
    expect(res.status).toBe(200);
  });

  it("GET config/client (feature flags, sans auth)", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/config/client");
    expect(res.status).toBe(200);
    expect(res.body?.features).toBeDefined();
    expect(typeof res.body.features.marketplace).toBe("boolean");
    expect(typeof res.body.features.chat).toBe("boolean");
    expect(typeof res.body.features.feedStock).toBe("boolean");
  });

  it("GET marketplace listings (catalogue publié)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/marketplace/listings")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET marketplace listings ?mine=true (mes annonces)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/marketplace/listings")
      .query({ mine: "true" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST marketplace listings (brouillon lié à la ferme seed)", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/marketplace/listings")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        title: "E2E contrat brouillon",
        farmId: ctx.farmId
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body?.id).toBeDefined();
    expect(res.body?.status).toBe("draft");
  });

  it("GET marketplace mes offres (acheteur)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/marketplace/offers")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
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

  it("PATCH /auth/me/profile (prénom + ferme accueil)", async () => {
    const res = await request(app.getHttpServer())
      .patch("/api/v1/auth/me/profile")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        firstName: "E2E",
        lastName: "Producteur",
        producerHomeFarmName: "Ferme contrat e2e"
      });
    expect(res.status).toBe(200);
    expect(res.body?.user?.firstName).toBe("E2E");
    expect(res.body?.user?.lastName).toBe("Producteur");
    expect(res.body?.user?.fullName).toBe("E2E Producteur");
    expect(res.body?.user?.producerHomeFarmName).toBe("Ferme contrat e2e");
    expect(res.body?.primaryFarm?.id).toBe(ctx.farmId);
  });

  it("PATCH /auth/me/profile (notifications + jeton push simulé)", async () => {
    const fakeToken = "ExponentPushToken[e2e-test-token-12345678901234567890]";
    const on = await request(app.getHttpServer())
      .patch("/api/v1/auth/me/profile")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({
        notificationsEnabled: true,
        expoPushToken: fakeToken,
        pushPlatform: "android"
      });
    expect(on.status).toBe(200);
    expect(on.body?.user?.notificationsEnabled).toBe(true);
    expect(on.body?.user?.pushNotificationsRegistered).toBe(true);

    const off = await request(app.getHttpServer())
      .patch("/api/v1/auth/me/profile")
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({ notificationsEnabled: false });
    expect(off.status).toBe(200);
    expect(off.body?.user?.notificationsEnabled).toBe(false);
    expect(off.body?.user?.pushNotificationsRegistered).toBe(false);
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
    expect(Array.isArray(res.body?.effectiveScopes)).toBe(true);
    expect(res.body?.effectiveScopes).toContain("*");
  });

  it("GET /farms/:farmId/members", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/members`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET invitations pending + POST créer + POST accepter (pair)", async () => {
    const pending = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/invitations`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(pending.status).toBe(200);
    expect(Array.isArray(pending.body)).toBe(true);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/invitations`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ role: "viewer" });
    expect(created.status).toBeGreaterThanOrEqual(200);
    expect(created.status).toBeLessThan(300);
    const inviteToken = created.body?.token as string;
    expect(inviteToken?.length).toBeGreaterThanOrEqual(16);

    const accepted = await request(app.getHttpServer())
      .post("/api/v1/invitations/accept")
      .set("Authorization", `Bearer ${ctx.peerToken}`)
      .send({ token: inviteToken });
    expect(accepted.status).toBeGreaterThanOrEqual(200);
    expect(accepted.status).toBeLessThan(300);
    expect(accepted.body?.farmId).toBe(ctx.farmId);
    expect(accepted.body?.ok).toBe(true);
  });

  it("GET /farms/:farmId/feed/types + overview + chart + stats + POST movement entrée", async () => {
    const types0 = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/feed/types`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(types0.status).toBe(200);
    expect(Array.isArray(types0.body)).toBe(true);

    const createdType = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/types`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        name: "Aliment contrat e2e",
        unit: "kg",
        color: "#111111"
      });
    expect(createdType.status).toBeGreaterThanOrEqual(200);
    expect(createdType.status).toBeLessThan(300);
    const typeId = createdType.body?.id as string;
    expect(typeId).toBeDefined();

    const postIn = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/movements`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        kind: "in",
        feedTypeId: typeId,
        quantityInput: 100,
        quantityUnit: "kg"
      });
    expect(postIn.status).toBeGreaterThanOrEqual(200);
    expect(postIn.status).toBeLessThan(300);
    expect(Number(postIn.body?.stockAfterKg)).toBeCloseTo(100, 3);

    const overview = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/feed/overview`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(overview.status).toBe(200);
    expect(overview.body?.farmId).toBe(ctx.farmId);

    const chart = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/feed/chart`)
      .query({ period: "6m" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(chart.status).toBe(200);
    expect(Array.isArray(chart.body?.monthKeys)).toBe(true);
    expect(Array.isArray(chart.body?.series)).toBe(true);

    const stats = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/feed/stats`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(stats.status).toBe(200);
    expect(Array.isArray(stats.body?.items)).toBe(true);

    const movements = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/feed/movements`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(movements.status).toBe(200);
    expect(Array.isArray(movements.body)).toBe(true);

    const sacType = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/types`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        name: "Aliment sac e2e",
        unit: "sac",
        weightPerBagKg: 25,
        color: "#222222"
      });
    expect(sacType.status).toBeGreaterThanOrEqual(200);
    expect(sacType.status).toBeLessThan(300);
    const sacId = sacType.body?.id as string;

    const inSac = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/movements`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        kind: "in",
        feedTypeId: sacId,
        quantityInput: 8,
        quantityUnit: "sac"
      });
    expect(inSac.status).toBeGreaterThanOrEqual(200);
    expect(inSac.status).toBeLessThan(300);
    expect(Number(inSac.body?.stockAfterKg)).toBeCloseTo(200, 3);

    const check = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/feed/movements`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        kind: "stock_check",
        feedTypeId: sacId,
        bagsCounted: 5
      });
    expect(check.status).toBeGreaterThanOrEqual(200);
    expect(check.status).toBeLessThan(300);
    expect(Number(check.body?.stockAfterKg)).toBeCloseTo(125, 3);
  });

  it("GET /chat/directory/users (recherche annuaire)", async () => {
    const short = await request(app.getHttpServer())
      .get("/api/v1/chat/directory/users")
      .query({ q: "x" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(short.status).toBe(400);

    const ok = await request(app.getHttpServer())
      .get("/api/v1/chat/directory/users")
      .query({ q: "Annuaire" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(ok.status).toBe(200);
    expect(Array.isArray(ok.body)).toBe(true);
    expect(
      ok.body.some(
        (u: { email?: string; id?: string }) =>
          u.id === ctx.peerUserId ||
          (typeof u.email === "string" &&
            u.email.includes("e2e-peer-directory"))
      )
    ).toBe(true);
  });

  it("GET /chat/rooms + POST salon ferme + messages", async () => {
    const rooms = await request(app.getHttpServer())
      .get("/api/v1/chat/rooms")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(rooms.status).toBe(200);
    expect(Array.isArray(rooms.body)).toBe(true);

    const ensure = await request(app.getHttpServer())
      .post(`/api/v1/chat/rooms/farm/${ctx.farmId}`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(ensure.status).toBeGreaterThanOrEqual(200);
    expect(ensure.status).toBeLessThan(300);
    const roomId = ensure.body?.id as string;
    expect(roomId).toBeDefined();

    const listMsg = await request(app.getHttpServer())
      .get(`/api/v1/chat/rooms/${roomId}/messages`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(listMsg.status).toBe(200);
    expect(Array.isArray(listMsg.body)).toBe(true);

    const posted = await request(app.getHttpServer())
      .post(`/api/v1/chat/rooms/${roomId}/messages`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ body: "Message contrat e2e chat" });
    expect(posted.status).toBeGreaterThanOrEqual(200);
    expect(posted.status).toBeLessThan(300);
    expect(posted.body?.body).toBe("Message contrat e2e chat");
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

  it("GET liste animaux + bandes + vue cheptel", async () => {
    const animals = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/animals`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);
    expect(animals.status).toBe(200);
    expect(
      animals.body.some((a: { id: string }) => a.id === ctx.animalId)
    ).toBe(true);

    const batches = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/batches`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);
    expect(batches.status).toBe(200);
    expect(
      batches.body.some((b: { id: string }) => b.id === ctx.batchId)
    ).toBe(true);

    const cheptel = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/cheptel`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);
    expect(cheptel.status).toBe(200);
    expect(cheptel.body?.kpis?.totalAnimals).toBeDefined();

    const logs = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/cheptel/status-logs`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId);
    expect(logs.status).toBe(200);
    expect(Array.isArray(logs.body)).toBe(true);

    const cfg = await request(app.getHttpServer())
      .put(`/api/v1/farms/${ctx.farmId}/cheptel-config`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({ housingBuildingsCount: 2 });
    expect(cfg.status).toBeGreaterThanOrEqual(200);
    expect(cfg.status).toBeLessThan(300);
  });

  it("GET détail animal", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/animals/${ctx.animalId}`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(ctx.animalId);
    expect(Array.isArray(res.body?.weights)).toBe(true);
  });

  it("PATCH statut animal (cheptel)", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/farms/${ctx.farmId}/animals/${ctx.animalId}/status`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({ status: "sold", note: "e2e statut" });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    const back = await request(app.getHttpServer())
      .patch(`/api/v1/farms/${ctx.farmId}/animals/${ctx.animalId}/status`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .set("X-Profile-Id", ctx.producerProfileId)
      .send({ status: "active" });
    expect(back.status).toBeGreaterThanOrEqual(200);
    expect(back.status).toBeLessThan(300);
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

  it("GET consultations vet + POST dossier + GET détail", async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/vet-consultations`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);

    const post = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/vet-consultations`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ subject: "E2E dossier véto contrat" });
    expect(post.status).toBeGreaterThanOrEqual(200);
    expect(post.status).toBeLessThan(300);
    const id = post.body?.id as string;
    expect(id).toBeDefined();

    const one = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/vet-consultations/${id}`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(one.status).toBe(200);
    expect(one.body?.subject).toBe("E2E dossier véto contrat");

    const attach = await request(app.getHttpServer())
      .post(
        `/api/v1/farms/${ctx.farmId}/vet-consultations/${id}/attachments`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        url: "https://example.com/e2e-piece-jointe.pdf",
        label: "Contrat e2e",
        mimeType: "application/pdf"
      });
    expect(attach.status).toBeGreaterThanOrEqual(200);
    expect(attach.status).toBeLessThan(300);
    expect(attach.body?.url).toContain("example.com");

    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/farms/${ctx.farmId}/vet-consultations/${id}`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ status: "resolved" });
    expect(patched.status).toBeGreaterThanOrEqual(200);
    expect(patched.status).toBeLessThan(300);
    expect(patched.body?.status).toBe("resolved");
  });

  it("GET consultations vet avec query status=open", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/vet-consultations`)
      .query({ status: "open" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET finance summary (financeRead)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/finance/summary`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.farmId).toBe(ctx.farmId);
    expect(res.body?.totalExpenses).toBeDefined();
    expect(res.body?.totalRevenues).toBeDefined();
    expect(res.body?.net).toBeDefined();
  });

  it("GET finance hub (overview, settings, categories, transactions, report, projection, simulation)", async () => {
    const ov = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/finance/overview`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(ov.status).toBe(200);
    expect(ov.body?.months3?.length).toBe(3);
    expect(ov.body?.settings?.currencyCode).toBeDefined();

    const st = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/finance/settings`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(st.status).toBe(200);
    expect(st.body?.currencyCode).toBeDefined();

    const cat = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/finance/categories`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(cat.status).toBe(200);
    expect(Array.isArray(cat.body)).toBe(true);

    const tx = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/finance/transactions`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(tx.status).toBe(200);
    expect(Array.isArray(tx.body)).toBe(true);

    const rep = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/finance/report`)
      .query({ period: "month" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(rep.status).toBe(200);
    expect(rep.body?.totals).toBeDefined();

    const proj = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/finance/projection`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(proj.status).toBe(200);
    expect(proj.body?.nextMonths?.length).toBe(3);

    const sim = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/finance/simulation`)
      .query({ saleHeadcount: "2", pricePerHead: "1000" })
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(sim.status).toBe(200);
    expect(sim.body?.projectedBalance).toBeDefined();
  });

  it("POST finance transaction unifiée (income)", async () => {
    const cats = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/finance/categories`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(cats.status).toBe(200);
    const incomeCat = (cats.body as Array<{ id: string; type: string }>).find(
      (c) => c.type === "income"
    );
    expect(incomeCat?.id).toBeDefined();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/finance/transactions`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        type: "income",
        financeCategoryId: incomeCat!.id,
        amount: 500,
        label: "E2E transaction unifiée",
        occurredAt: "2026-01-15T12:00:00.000Z"
      });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body?.label).toBe("E2E transaction unifiée");
  });

  it("POST dépense finance puis DELETE (financeWrite)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/finance/expenses`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        amount: 12500.5,
        label: "E2E dépense contrat",
        category: "test"
      });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body?.label).toBe("E2E dépense contrat");
    const expenseId = res.body?.id as string;
    expect(expenseId).toBeDefined();

    const patch = await request(app.getHttpServer())
      .patch(
        `/api/v1/farms/${ctx.farmId}/finance/expenses/${expenseId}`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        label: "E2E dépense contrat (modifiée)",
        amount: 13000
      });
    expect(patch.status).toBeGreaterThanOrEqual(200);
    expect(patch.status).toBeLessThan(300);
    expect(patch.body?.label).toBe("E2E dépense contrat (modifiée)");
    expect(patch.body?.amount).toBe(13000);

    const del = await request(app.getHttpServer())
      .delete(
        `/api/v1/farms/${ctx.farmId}/finance/expenses/${expenseId}`
      )
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(del.status).toBeGreaterThanOrEqual(200);
    expect(del.status).toBeLessThan(300);
  });

  it("POST revenu finance puis PATCH puis DELETE (financeWrite)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/finance/revenues`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        amount: 9900,
        label: "E2E revenu contrat",
        category: "test"
      });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body?.label).toBe("E2E revenu contrat");
    const revenueId = res.body?.id as string;
    expect(revenueId).toBeDefined();

    const patch = await request(app.getHttpServer())
      .patch(
        `/api/v1/farms/${ctx.farmId}/finance/revenues/${revenueId}`
      )
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        label: "E2E revenu contrat (modifié)",
        amount: 10050
      });
    expect(patch.status).toBeGreaterThanOrEqual(200);
    expect(patch.status).toBeLessThan(300);
    expect(patch.body?.label).toBe("E2E revenu contrat (modifié)");
    expect(patch.body?.amount).toBe(10050);

    const del = await request(app.getHttpServer())
      .delete(
        `/api/v1/farms/${ctx.farmId}/finance/revenues/${revenueId}`
      )
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(del.status).toBeGreaterThanOrEqual(200);
    expect(del.status).toBeLessThan(300);
  });

  it("GET liste bâtiments (housingRead)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/barns`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST bâtiment puis loge (housingWrite)", async () => {
    const barn = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/barns`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ name: "E2E bâtiment contrat", code: "E2E-B" });
    expect(barn.status).toBeGreaterThanOrEqual(200);
    expect(barn.status).toBeLessThan(300);
    const barnId = barn.body?.id as string;
    expect(barnId).toBeDefined();

    const pen = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/barns/${barnId}/pens`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ name: "E2E loge contrat", zoneLabel: "contrat" });
    expect(pen.status).toBeGreaterThanOrEqual(200);
    expect(pen.status).toBeLessThan(300);
    expect(pen.body?.name).toBe("E2E loge contrat");
    const penId = pen.body?.id as string;
    expect(penId).toBeDefined();

    const log = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/pens/${penId}/logs`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ type: "cleaning", title: "E2E entrée journal loge" });
    expect(log.status).toBeGreaterThanOrEqual(200);
    expect(log.status).toBeLessThan(300);
    expect(log.body?.title).toBe("E2E entrée journal loge");
  });

  it("POST pen-move : placement animal puis déplacement (housingWrite)", async () => {
    const barn = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/barns`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ name: "E2E bâtiment pen-move", code: "E2E-PM" });
    expect(barn.status).toBeGreaterThanOrEqual(200);
    expect(barn.status).toBeLessThan(300);
    const barnId = barn.body?.id as string;
    expect(barnId).toBeDefined();

    const penFrom = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/barns/${barnId}/pens`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ name: "E2E loge origine pen-move", zoneLabel: "pm-from" });
    expect(penFrom.status).toBeGreaterThanOrEqual(200);
    expect(penFrom.status).toBeLessThan(300);
    const penFromId = penFrom.body?.id as string;
    expect(penFromId).toBeDefined();

    const penTo = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/barns/${barnId}/pens`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ name: "E2E loge destination pen-move", zoneLabel: "pm-to" });
    expect(penTo.status).toBeGreaterThanOrEqual(200);
    expect(penTo.status).toBeLessThan(300);
    const penToId = penTo.body?.id as string;
    expect(penToId).toBeDefined();

    const startPl = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/pens/${penFromId}/placements`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ animalId: ctx.animalId });
    expect(startPl.status).toBeGreaterThanOrEqual(200);
    expect(startPl.status).toBeLessThan(300);

    const move = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/pen-move`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        fromPenId: penFromId,
        toPenId: penToId,
        animalId: ctx.animalId,
        note: "E2E déplacement contrat pen-move"
      });
    expect(move.status).toBeGreaterThanOrEqual(200);
    expect(move.status).toBeLessThan(300);
    expect(move.body?.pen?.id).toBe(penToId);
    expect(move.body?.animal?.id).toBe(ctx.animalId);
  });

  it("GET dashboard finance-timeseries, gestations, health, feed-stock", async () => {
    const fin = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/dashboard/finance-timeseries`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(fin.status).toBe(200);
    expect(fin.body?.farmId).toBe(ctx.farmId);
    expect(Array.isArray(fin.body?.months)).toBe(true);
    expect(fin.body.months.length).toBe(3);

    const gest = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/dashboard/gestations`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(gest.status).toBe(200);
    expect(gest.body?.farmId).toBe(ctx.farmId);
    expect(Array.isArray(gest.body?.items)).toBe(true);
    expect(gest.body.items.length).toBeGreaterThanOrEqual(1);
    expect(typeof gest.body.items[0].urgent).toBe("boolean");
    expect(gest.body.items[0].urgent).toBe(true);

    const health = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/dashboard/health`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(health.status).toBe(200);
    expect(health.body?.farmId).toBe(ctx.farmId);
    expect(health.body?.mortalityWindowDays).toBe(30);

    const feed = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/dashboard/feed-stock`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(feed.status).toBe(200);
    expect(feed.body?.farmId).toBe(ctx.farmId);
    expect(Array.isArray(feed.body?.items)).toBe(true);
  });

  it("GET rapports preview + score + liste + POST generate + GET rapport + PDF", async () => {
    const auth = {
      Authorization: `Bearer ${ctx.token}`,
      "X-Profile-Id": ctx.producerProfileId
    };
    const y = new Date().getUTCFullYear();
    const m = new Date().getUTCMonth() + 1;
    const prev = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/reports/preview`)
      .query({ periodType: "monthly", year: String(y), month: String(m) })
      .set(auth);
    expect(prev.status).toBe(200);
    expect(typeof prev.body?.score?.global).toBe("number");
    expect(prev.body?.sections?.finance).toBeDefined();

    const score = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/score`)
      .query({ year: String(y), month: String(m) })
      .set(auth);
    expect(score.status).toBe(200);
    expect(typeof score.body?.scoreGlobal).toBe("number");

    const gen = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/reports/generate`)
      .set(auth)
      .send({
        periodType: "monthly",
        anchor: { year: y, month: m }
      });
    expect(gen.status).toBe(201);
    expect(gen.body?.id).toBeDefined();

    const list = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/reports`)
      .set(auth);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);

    const reportId = gen.body.id as string;
    const one = await request(app.getHttpServer())
      .get(`/api/v1/reports/${reportId}`)
      .set({ Authorization: `Bearer ${ctx.token}` });
    expect(one.status).toBe(200);
    expect(one.body?.farmId).toBe(ctx.farmId);

    const pdf = await request(app.getHttpServer())
      .get(`/api/v1/reports/${reportId}/pdf`)
      .set({ Authorization: `Bearer ${ctx.token}` });
    expect(pdf.status).toBe(200);
    expect(String(pdf.headers["content-type"] || "")).toContain("pdf");
    expect(Buffer.byteLength(pdf.body as Buffer)).toBeGreaterThan(500);
  });

  it("GET ferme santé (overview, upcoming, mortality, events) + POST dossier + lien dépense", async () => {
    const auth = {
      Authorization: `Bearer ${ctx.token}`,
      "X-Profile-Id": ctx.producerProfileId
    };

    const overview = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/health/overview`)
      .set(auth);
    expect(overview.status).toBe(200);
    expect(overview.body?.farmId).toBe(ctx.farmId);

    const upcoming = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/health/upcoming`)
      .set(auth);
    expect(upcoming.status).toBe(200);
    expect(upcoming.body?.farmId).toBe(ctx.farmId);

    const mort30 = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/health/mortality-rate`)
      .set(auth);
    expect(mort30.status).toBe(200);
    expect(mort30.body?.periodDays).toBe(30);

    const mort90 = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/health/mortality-rate`)
      .query({ period: "90" })
      .set(auth);
    expect(mort90.status).toBe(200);
    expect(mort90.body?.periodDays).toBe(90);

    const events0 = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/health/events`)
      .set(auth);
    expect(events0.status).toBe(200);
    expect(Array.isArray(events0.body)).toBe(true);

    const vac = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/health/events`)
      .set(auth)
      .send({
        kind: "vaccination",
        entityType: "group",
        entityId: ctx.batchId,
        detail: { vaccineName: "E2E vaccin contrat ferme santé" }
      });
    expect(vac.status).toBeGreaterThanOrEqual(200);
    expect(vac.status).toBeLessThan(300);
    expect(vac.body?.id).toBeDefined();

    const events1 = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/health/events`)
      .query({ kind: "vaccination" })
      .set(auth);
    expect(events1.status).toBe(200);
    expect(Array.isArray(events1.body)).toBe(true);

    const treatment = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/health/events`)
      .set(auth)
      .send({
        kind: "treatment",
        entityType: "group",
        entityId: ctx.batchId,
        detail: { drugName: "E2E traitement contrat santé" }
      });
    expect(treatment.status).toBeGreaterThanOrEqual(200);
    expect(treatment.status).toBeLessThan(300);
    const treatmentId = treatment.body?.id as string;
    expect(treatmentId).toBeDefined();

    const expense = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/finance/expenses`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        amount: 5000,
        label: "E2E dépense lien santé ferme",
        category: "test"
      });
    expect(expense.status).toBeGreaterThanOrEqual(200);
    expect(expense.status).toBeLessThan(300);
    const expenseId = expense.body?.id as string;
    expect(expenseId).toBeDefined();

    const link = await request(app.getHttpServer())
      .post(
        `/api/v1/farms/${ctx.farmId}/health/events/${treatmentId}/link-transaction`
      )
      .set(auth)
      .send({ expenseId });
    expect(link.status).toBeGreaterThanOrEqual(200);
    expect(link.status).toBeLessThan(300);
    expect(link.body?.ok).toBe(true);
  });
});

if (!hasDb || !hasJwt) {
  // eslint-disable-next-line no-console -- message utile quand la suite est ignorée
  console.info(
    "[e2e] Ignoré : renseigner DATABASE_URL (ex. chaîne Supabase → Database) et SUPABASE_JWT_SECRET (Settings → API). Voir docs/SETUP.md, section Tests e2e."
  );
}
