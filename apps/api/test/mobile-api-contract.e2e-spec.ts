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
});

if (!hasDb || !hasJwt) {
  // eslint-disable-next-line no-console -- message utile quand la suite est ignorée
  console.info(
    "[e2e] Ignoré : renseigner DATABASE_URL (ex. chaîne Supabase → Database) et SUPABASE_JWT_SECRET (Settings → API). Voir docs/SETUP.md, section Tests e2e."
  );
}
