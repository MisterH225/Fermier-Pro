import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient, VetAppointmentStatus } from "@prisma/client";
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

function futureIso(daysAhead = 7, hourUtc = 10): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

describeOrSkip("RDV vétérinaire escrow (e2e)", () => {
  let app: NestExpressApplication;
  let ctx: E2EVetRbacSeedResult;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = "100000";
    ctx = await seedE2eVetRbacFixtures(PrismaClient);
    app = await createTestApp();
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

  it("cycle complet : demande → acceptation → paiement → prestation → notation", async () => {
    const scheduledAt = futureIso(8);

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/vet-appointments`)
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .send({
        vetProfileId: ctx.vetProfileId,
        scheduledAt,
        reason: "Visite de contrôle",
        notes: "Test e2e RDV"
      });

    expect(createRes.status).toBe(201);
    const appointmentId = createRes.body.id as string;
    expect(createRes.body.status).toBe("APPOINTMENT_REQUESTED");

    const beforePay = await ctx.prisma.vetAppointment.findUniqueOrThrow({
      where: { id: appointmentId }
    });
    expect(beforePay.calendarBlocked).toBe(false);

    const acceptRes = await request(app.getHttpServer())
      .post(`/api/v1/vet-appointments/${appointmentId}/accept`)
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId)
      .send({ servicePrice: 75000, confirmedAt: scheduledAt });

    expect(acceptRes.status).toBe(201);
    expect(acceptRes.body.status).toBe("AWAITING_PAYMENT");
    expect(Number(acceptRes.body.servicePrice)).toBe(75000);

    const initRes = await request(app.getHttpServer())
      .post(`/api/v1/vet-appointments/${appointmentId}/payment/initiate`)
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .send({ paymentMethod: "mobile_money" });

    expect(initRes.status).toBe(201);
    const providerRef = initRes.body.providerRef as string;
    expect(providerRef).toBeTruthy();

    const payRes = await request(app.getHttpServer())
      .post(`/api/v1/vet-appointments/${appointmentId}/payment/confirm`)
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .send({ providerRef });

    expect(payRes.status).toBe(201);
    expect(payRes.body.status).toBe("APPOINTMENT_CONFIRMED");

    const afterPay = await ctx.prisma.vetAppointment.findUniqueOrThrow({
      where: { id: appointmentId }
    });
    expect(afterPay.calendarBlocked).toBe(true);

    const completeRes = await request(app.getHttpServer())
      .post(`/api/v1/vet-appointments/${appointmentId}/complete`)
      .set("Authorization", `Bearer ${ctx.producerToken}`);

    expect(completeRes.status).toBe(201);
    expect(completeRes.body.status).toBe("APPOINTMENT_COMPLETED");

    const rateRes = await request(app.getHttpServer())
      .post(`/api/v1/vet-appointments/${appointmentId}/rating`)
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .send({
        rating: 5,
        comment: "Excellente prestation e2e",
        tags: ["ponctuel", "professionnel"]
      });

    expect(rateRes.status).toBe(201);
    expect(rateRes.body.status).toBe("APPOINTMENT_RATED");
    expect(rateRes.body.rating?.rating).toBe(5);

    const vetProfile = await ctx.prisma.vetProfile.findUniqueOrThrow({
      where: { id: ctx.vetProfileId }
    });
    expect(vetProfile.completedAppointments).toBeGreaterThanOrEqual(1);
  });

  it("vétérinaire refuse une demande → APPOINTMENT_REFUSED", async () => {
    const scheduledAt = futureIso(6);

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/vet-appointments`)
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .send({
        vetProfileId: ctx.vetProfileId,
        scheduledAt,
        reason: "Visite à refuser"
      });

    expect(createRes.status).toBe(201);
    const appointmentId = createRes.body.id as string;

    const refuseRes = await request(app.getHttpServer())
      .post(`/api/v1/vet-appointments/${appointmentId}/refuse`)
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId)
      .send({ refusalReason: "Indisponible e2e" });

    expect(refuseRes.status).toBe(201);
    expect(refuseRes.body.status).toBe("APPOINTMENT_REFUSED");

    const row = await ctx.prisma.vetAppointment.findUniqueOrThrow({
      where: { id: appointmentId }
    });
    expect(row.status).toBe(VetAppointmentStatus.APPOINTMENT_REFUSED);
    expect(row.refusalReason).toBe("Indisponible e2e");
  });

  it("paiement sans devis accepté → 400", async () => {
    const scheduledAt = futureIso(11);

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/vet-appointments`)
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .send({
        vetProfileId: ctx.vetProfileId,
        scheduledAt,
        reason: "Sans acceptation véto"
      });

    expect(createRes.status).toBe(201);
    const appointmentId = createRes.body.id as string;
    expect(createRes.body.status).toBe("APPOINTMENT_REQUESTED");

    const initRes = await request(app.getHttpServer())
      .post(`/api/v1/vet-appointments/${appointmentId}/payment/initiate`)
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .send({ paymentMethod: "mobile_money" });

    expect(initRes.status).toBe(400);

    const acceptInvalidRes = await request(app.getHttpServer())
      .post(`/api/v1/vet-appointments/${appointmentId}/accept`)
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId)
      .send({ servicePrice: 0, confirmedAt: scheduledAt });

    expect(acceptInvalidRes.status).toBe(400);
  });

  it("une demande en attente ne bloque pas le calendrier véto", async () => {
    const scheduledAt = futureIso(9);

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/vet-appointments`)
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .send({
        vetProfileId: ctx.vetProfileId,
        scheduledAt,
        reason: "Contrôle sanitaire"
      });

    expect(createRes.status).toBe(201);
    const row = await ctx.prisma.vetAppointment.findUniqueOrThrow({
      where: { id: createRes.body.id as string }
    });
    expect(row.status).toBe(VetAppointmentStatus.APPOINTMENT_REQUESTED);
    expect(row.calendarBlocked).toBe(false);
  });

  it("après paiement, une seconde demande proche détecte un conflit", async () => {
    const scheduledAt = futureIso(10);

    const firstRes = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/vet-appointments`)
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .send({
        vetProfileId: ctx.vetProfileId,
        scheduledAt,
        reason: "Premier RDV confirmé"
      });

    expect(firstRes.status).toBe(201);
    const firstId = firstRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/vet-appointments/${firstId}/accept`)
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId)
      .send({ servicePrice: 50000, confirmedAt: scheduledAt })
      .expect(201);

    const init = await request(app.getHttpServer())
      .post(`/api/v1/vet-appointments/${firstId}/payment/initiate`)
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .send({ paymentMethod: "mobile_money" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/vet-appointments/${firstId}/payment/confirm`)
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .send({ providerRef: init.body.providerRef })
      .expect(201);

    const nearbyAt = new Date(scheduledAt);
    nearbyAt.setUTCHours(nearbyAt.getUTCHours() + 1);

    const secondRes = await request(app.getHttpServer())
      .post(`/api/v1/farms/${ctx.farmId}/vet-appointments`)
      .set("Authorization", `Bearer ${ctx.producerToken}`)
      .send({
        vetProfileId: ctx.vetProfileId,
        scheduledAt: nearbyAt.toISOString(),
        reason: "Second RDV proche"
      });

    expect(secondRes.status).toBe(201);
    expect(secondRes.body.conflictStatus).toMatch(/CONFLICT_/);
  });

  it("véto planifie visite gratuite → VetAppointment APPOINTMENT_CONFIRMED", async () => {
    const scheduledAt = futureIso(12);

    const res = await request(app.getHttpServer())
      .post("/api/v1/vet-profiles/me/schedule-visit")
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId)
      .send({
        farmId: ctx.farmId,
        scheduledAt,
        reason: "routine",
        notes: "Visite e2e planifiée par le véto"
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("APPOINTMENT_CONFIRMED");

    const row = await ctx.prisma.vetAppointment.findUniqueOrThrow({
      where: { id: res.body.id as string }
    });
    expect(row.vetUserId).toBe(ctx.vetUserId);
    expect(row.producerUserId).toBe(ctx.producerUserId);
    expect(row.calendarBlocked).toBe(true);
  });

  it("véto planifie avec tarif → AWAITING_PAYMENT", async () => {
    const scheduledAt = futureIso(13);

    const res = await request(app.getHttpServer())
      .post("/api/v1/vet-profiles/me/schedule-visit")
      .set("Authorization", `Bearer ${ctx.vetToken}`)
      .set("X-Profile-Id", ctx.veterinarianProfileId)
      .send({
        farmId: ctx.farmId,
        scheduledAt,
        reason: "vaccination",
        consultationPrice: 45000
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("AWAITING_PAYMENT");

    const row = await ctx.prisma.vetAppointment.findUniqueOrThrow({
      where: { id: res.body.id as string }
    });
    expect(Number(row.servicePrice)).toBe(45000);
    expect(row.calendarBlocked).toBe(false);
  });
});
