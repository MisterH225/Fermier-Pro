import { ForbiddenException } from "@nestjs/common";
import { VetAppointmentStatus } from "@prisma/client";
import { VetAppointmentService } from "./vet-appointment.service";

describe("VetAppointmentService.confirmServiceCompletion", () => {
  const producer = { id: "producer-1", fullName: "Ami Producer" } as never;
  const vet = { id: "vet-1", fullName: "Dr Vet" } as never;
  const stranger = { id: "other-1", fullName: "Other" } as never;

  function baseRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "appt-1",
      farmId: "farm-1",
      producerUserId: "producer-1",
      vetProfileId: "vp-1",
      vetUserId: "vet-1",
      status: VetAppointmentStatus.APPOINTMENT_CONFIRMED,
      requestedAt: new Date("2026-08-01T10:00:00.000Z"),
      confirmedAt: new Date("2026-08-01T10:00:00.000Z"),
      estimatedDurationHours: 1,
      reason: "routine",
      notes: null,
      farmLocation: "Dakar",
      refusalReason: null,
      vetResponseNotes: null,
      servicePrice: null,
      isFree: true,
      commissionRate: 0.05,
      commissionAmount: null,
      vetReceivedAmount: null,
      blockedAmount: null,
      paymentDeadline: null,
      paymentConfirmedAt: null,
      proposedByVetAt: new Date("2026-07-20T10:00:00.000Z"),
      completedAt: null,
      visitReportSubmittedAt: new Date("2026-08-01T11:00:00.000Z"),
      visitSubjectsTreated: "Contrôle routine",
      visitDiagnosis: "RAS",
      visitPrescription: "Aucun traitement",
      farmHealthRecordId: "hr-1",
      conflictStatus: null,
      conflictDetails: null,
      calendarBlocked: true,
      currency: "XOF",
      farm: { id: "farm-1", name: "Ferme Test", address: "Dakar" },
      producer: { id: "producer-1", fullName: "Ami Producer", phone: null },
      vetProfile: {
        id: "vp-1",
        fullName: "Dr Vet",
        professionalPhone: null
      },
      vet: { id: "vet-1", fullName: "Dr Vet" },
      rating: null,
      ...overrides
    };
  }

  function buildService(row: ReturnType<typeof baseRow>) {
    const fundCreate = jest.fn();
    const platformRevenueCreate = jest.fn();
    const creditVetPayout = jest.fn().mockResolvedValue(undefined);
    const sendToUser = jest.fn().mockResolvedValue(undefined);

    const completedRow = {
      ...row,
      status: VetAppointmentStatus.APPOINTMENT_COMPLETED,
      completedAt: new Date(),
      commissionAmount: 0,
      vetReceivedAmount: 0
    };

    const prisma = {
      vetAppointment: {
        findUnique: jest.fn().mockResolvedValue(row)
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          vetAppointment: {
            update: jest.fn().mockResolvedValue(completedRow)
          },
          vetAppointmentFundMovement: { create: fundCreate },
          platformRevenue: { create: platformRevenueCreate },
          vetProfile: {
            update: jest.fn().mockResolvedValue({})
          },
          farmExpense: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: "exp-1" })
          }
        };
        return fn(tx);
      })
    };

    const service = new VetAppointmentService(
      prisma as never,
      {} as never,
      { record: jest.fn() } as never,
      { sendToUser } as never,
      { notify: sendToUser } as never,
      {} as never,
      { get: jest.fn() } as never,
      { getVetCommissionRate: jest.fn().mockResolvedValue(0.05) } as never,
      {} as never,
      { creditVetPayout } as never,
      { trackFireAndForget: jest.fn() } as never
    );

    return {
      service,
      prisma,
      fundCreate,
      platformRevenueCreate,
      creditVetPayout,
      sendToUser
    };
  }

  it("visite gratuite clôturable par le producteur sans mouvement de fonds", async () => {
    const { service, fundCreate, platformRevenueCreate, creditVetPayout, sendToUser } =
      buildService(baseRow({ isFree: true, servicePrice: null }));

    const result = await service.confirmServiceCompletion(producer, "appt-1");

    expect(result.status).toBe(VetAppointmentStatus.APPOINTMENT_COMPLETED);
    expect(result.requiresRating).toBe(true);
    expect(fundCreate).not.toHaveBeenCalled();
    expect(platformRevenueCreate).not.toHaveBeenCalled();
    expect(creditVetPayout).not.toHaveBeenCalled();
    expect(sendToUser).toHaveBeenCalledWith(
      "vet-1",
      "Visite terminée",
      expect.stringContaining("Aucun règlement"),
      expect.objectContaining({ type: "vet_appointment_completed" })
    );
  });

  it("visite gratuite clôturable par le vétérinaire", async () => {
    const { service, fundCreate, creditVetPayout, sendToUser } = buildService(
      baseRow({ isFree: true })
    );

    const result = await service.confirmServiceCompletion(vet, "appt-1");

    expect(result.status).toBe(VetAppointmentStatus.APPOINTMENT_COMPLETED);
    expect(result.requiresRating).toBe(false);
    expect(fundCreate).not.toHaveBeenCalled();
    expect(creditVetPayout).not.toHaveBeenCalled();
    expect(sendToUser).toHaveBeenCalledWith(
      "producer-1",
      "Visite terminée",
      expect.any(String),
      expect.objectContaining({ type: "vet_appointment_completed" })
    );
  });

  it("visite payante inchangée : producteur libère les fonds", async () => {
    const paid = baseRow({
      isFree: false,
      servicePrice: 10000,
      blockedAmount: 10000,
      commissionRate: 0.05
    });
    const { service, fundCreate, platformRevenueCreate, creditVetPayout } =
      buildService(paid);

    const result = await service.confirmServiceCompletion(producer, "appt-1");

    expect(result.status).toBe(VetAppointmentStatus.APPOINTMENT_COMPLETED);
    expect(result.requiresRating).toBe(true);
    expect(fundCreate).toHaveBeenCalledTimes(2);
    expect(platformRevenueCreate).toHaveBeenCalledTimes(1);
    expect(creditVetPayout).toHaveBeenCalled();
  });

  it("visite payante : le vétérinaire ne peut pas clôturer", async () => {
    const { service } = buildService(
      baseRow({ isFree: false, servicePrice: 10000 })
    );

    await expect(service.confirmServiceCompletion(vet, "appt-1")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("refuse la clôture sans rapport de visite", async () => {
    const { BadRequestException: BRE } = await import("@nestjs/common");
    const { service } = buildService(
      baseRow({ visitReportSubmittedAt: null })
    );
    await expect(
      service.confirmServiceCompletion(producer, "appt-1")
    ).rejects.toBeInstanceOf(BRE);
  });

  it("RDV confirmé orphelin (sans tarif ni paiement) clôturable sans fonds", async () => {
    const { service, fundCreate, creditVetPayout, sendToUser } = buildService(
      baseRow({
        isFree: false,
        servicePrice: null,
        blockedAmount: null,
        paymentConfirmedAt: null
      })
    );

    const result = await service.confirmServiceCompletion(producer, "appt-1");

    expect(result.status).toBe(VetAppointmentStatus.APPOINTMENT_COMPLETED);
    expect(fundCreate).not.toHaveBeenCalled();
    expect(creditVetPayout).not.toHaveBeenCalled();
    expect(sendToUser).toHaveBeenCalledWith(
      "vet-1",
      "Visite terminée",
      expect.stringContaining("Aucun règlement"),
      expect.objectContaining({ type: "vet_appointment_completed" })
    );
  });

  it("tiers non partie → 403", async () => {
    const { service } = buildService(baseRow({ isFree: true }));
    await expect(
      service.confirmServiceCompletion(stranger, "appt-1")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
