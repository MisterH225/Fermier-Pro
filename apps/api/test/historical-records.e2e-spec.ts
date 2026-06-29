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

const base = (farmId: string) => `/api/v1/farms/${farmId}/historical-records`;

describeOrSkip("Historique pré-app — dépenses & revenus antérieurs (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2ESeedResult;
  let expenseRecordId: string;
  let incomeRecordId: string;
  let importBatchId: string;
  let walletBalanceBefore: string | null;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eFixtures(PrismaClient);
    app = await createTestApp();

    const wallet = await request(app.getHttpServer())
      .get("/api/v1/users/me/wallet")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(wallet.status).toBe(200);
    walletBalanceBefore = String(wallet.body?.balance ?? "0");

    const entriesBefore = await ctx.prisma.userWalletEntry.count({
      where: { wallet: { userId: ctx.userId } }
    });
    expect(entriesBefore).toBe(0);
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

  it("refuse l'accès lecture à un membre sans scope finance", async () => {
    const res = await request(app.getHttpServer())
      .get(`${base(ctx.farmId)}/summary`)
      .set("Authorization", `Bearer ${ctx.peerToken}`);
    expect(res.status).toBe(403);
    expect(String(res.body?.message ?? "")).toContain("finance.read");
  });

  it("POST quick-total dépense (financeWrite)", async () => {
    const res = await request(app.getHttpServer())
      .post(`${base(ctx.farmId)}/quick-total`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        movementType: "expense",
        category: "aliments",
        amount: 150_000,
        periodEnd: "2024-12-31",
        notes: "Aliments avant inscription e2e"
      });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body?.movement_type).toBe("expense");
    expect(res.body?.category).toBe("aliments");
    expect(Number(res.body?.amount)).toBe(150_000);
    expect(res.body?.entry_mode).toBe("quick_total");
    expenseRecordId = res.body.id as string;
    expect(expenseRecordId).toBeDefined();
  });

  it("POST quick-total revenu (financeWrite)", async () => {
    const res = await request(app.getHttpServer())
      .post(`${base(ctx.farmId)}/quick-total`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        movementType: "income",
        category: "vente_animaux",
        amount: 320_000,
        periodEnd: "2024-11-30"
      });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body?.movement_type).toBe("income");
    expect(res.body?.category).toBe("vente_animaux");
    incomeRecordId = res.body.id as string;
    expect(incomeRecordId).toBeDefined();
  });

  it("rejette une catégorie incompatible avec le type", async () => {
    const res = await request(app.getHttpServer())
      .post(`${base(ctx.farmId)}/quick-total`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        movementType: "income",
        category: "aliments",
        amount: 1000,
        periodEnd: "2024-01-01"
      });
    expect(res.status).toBe(400);
  });

  it("GET summary agrège revenus et dépenses historiques", async () => {
    const res = await request(app.getHttpServer())
      .get(`${base(ctx.farmId)}/summary`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.total_income).toBe(320_000);
    expect(res.body?.total_expense).toBe(150_000);
    expect(res.body?.net_result).toBe(170_000);
    expect(res.body?.records_count).toBe(2);
    expect(res.body?.by_category?.aliments).toBe(150_000);
    expect(res.body?.by_category?.vente_animaux).toBe(320_000);
  });

  it("GET liste les enregistrements historiques", async () => {
    const res = await request(app.getHttpServer())
      .get(base(ctx.farmId))
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    const ids = (res.body as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toContain(expenseRecordId);
    expect(ids).toContain(incomeRecordId);
  });

  it("POST import/preview parse un CSV", async () => {
    const csv = [
      "date,type,categorie,montant,description",
      "2023-06-01,expense,aliments,25000,Ancien aliment",
      "2023-07-15,income,vente,80000,Vente ancienne",
      "bad-row,bad,aliments,0,Ligne invalide"
    ].join("\n");

    const res = await request(app.getHttpServer())
      .post(`${base(ctx.farmId)}/import/preview`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .attach("file", Buffer.from(csv, "utf-8"), {
        filename: "historique-e2e.csv",
        contentType: "text/csv"
      });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body?.valid_rows?.length).toBe(2);
    expect(res.body?.invalid_rows?.length).toBe(1);
    expect(res.body?.summary?.total_income).toBe(80_000);
    expect(res.body?.summary?.total_expense).toBe(25_000);
  });

  it("POST import/preview sans fichier → 400", async () => {
    const res = await request(app.getHttpServer())
      .post(`${base(ctx.farmId)}/import/preview`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(400);
  });

  it("POST import/confirm insère le lot", async () => {
    const res = await request(app.getHttpServer())
      .post(`${base(ctx.farmId)}/import/confirm`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({
        filename: "historique-e2e.csv",
        rows: [
          {
            date: "2023-06-01",
            type: "expense",
            categorie: "aliments",
            montant: 25_000,
            description: "Ancien aliment"
          },
          {
            date: "2023-07-15",
            type: "income",
            categorie: "vente",
            montant: 80_000,
            description: "Vente ancienne"
          }
        ]
      });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body?.inserted).toBe(2);
    importBatchId = res.body.batch_id as string;
    expect(importBatchId).toBeDefined();

    const summary = await request(app.getHttpServer())
      .get(`${base(ctx.farmId)}/summary`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(summary.body?.records_count).toBe(4);
    expect(summary.body?.total_income).toBe(400_000);
    expect(summary.body?.total_expense).toBe(175_000);
    expect(summary.body?.net_result).toBe(225_000);
  });

  it("finance/overview expose l'historique sans modifier balanceAllTime app", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/finance/overview`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.historical?.recordsCount).toBe(4);
    expect(Number(res.body?.historical?.totalIncome)).toBe(400_000);
    expect(Number(res.body?.historical?.totalExpense)).toBe(175_000);
    expect(Number(res.body?.historical?.netResult)).toBe(225_000);

    const appBalance = Number(res.body?.balanceAllTime ?? 0);
    const globalBalance = Number(res.body?.balanceAllTimeWithHistorical ?? 0);
    expect(globalBalance - appBalance).toBe(225_000);
  });

  it("profitability/dashboard intègre historicalPeriod et lifetime", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/farms/${ctx.farmId}/profitability/dashboard`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.historicalPeriod?.recordsCount).toBe(4);
    expect(res.body?.historicalPeriod?.income).toBe(400_000);
    expect(res.body?.historicalPeriod?.expense).toBe(175_000);
    expect(res.body?.historicalPeriod?.netResult).toBe(225_000);
    expect(res.body?.lifetime?.revenues).toBeGreaterThanOrEqual(400_000);
    expect(res.body?.lifetime?.costsTotal).toBeGreaterThanOrEqual(175_000);
    expect(res.body?.netMargin).toBe(res.body?.lifetime?.netMargin);
  });

  it("n'impacte pas le solde wallet utilisateur", async () => {
    const wallet = await request(app.getHttpServer())
      .get("/api/v1/users/me/wallet")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(wallet.status).toBe(200);
    expect(String(wallet.body?.balance ?? "0")).toBe(walletBalanceBefore);

    const entries = await ctx.prisma.userWalletEntry.count({
      where: { wallet: { userId: ctx.userId } }
    });
    expect(entries).toBe(0);
  });

  it("DELETE batch/:batchId supprime tout le lot d'import", async () => {
    const res = await request(app.getHttpServer())
      .delete(`${base(ctx.farmId)}/batch/${importBatchId}`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.deleted).toBe(2);

    const summary = await request(app.getHttpServer())
      .get(`${base(ctx.farmId)}/summary`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(summary.body?.records_count).toBe(2);
    expect(summary.body?.total_income).toBe(320_000);
    expect(summary.body?.total_expense).toBe(150_000);
  });

  it("DELETE :id supprime un enregistrement", async () => {
    const res = await request(app.getHttpServer())
      .delete(`${base(ctx.farmId)}/${expenseRecordId}`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body?.message).toBe("Supprimé");

    const summary = await request(app.getHttpServer())
      .get(`${base(ctx.farmId)}/summary`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(summary.body?.records_count).toBe(1);
    expect(summary.body?.total_expense).toBe(0);
    expect(summary.body?.total_income).toBe(320_000);
  });
});
