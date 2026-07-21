import { BadRequestException, ConflictException } from "@nestjs/common";
import { VetAppointmentStatus } from "@prisma/client";
import { VetAppointmentService } from "./vet-appointment.service";

describe("VetAppointmentService.submitVisitReport", () => {
  const vet = { id: "vet-1", fullName: "Dr Vet" } as never;

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
      servicePrice: 25000,
      isFree: false,
      commissionRate: 0.05,
      commissionAmount: null,
      vetReceivedAmount: null,
      blockedAmount: 25000,
      paymentDeadline: null,
      paymentConfirmedAt: new Date("2026-07-28T10:00:00.000Z"),
      proposedByVetAt: null,
      completedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      visitReportSubmittedAt: null,
      visitSubjectsTreated: null,
      visitDiagnosis: null,
      visitPrescription: null,
      farmHealthRecordId: null,
      conflictStatus: null,
      conflictDetails: null,
      calendarBlocked: true,
      currency: "XOF",
      farm: { name: "Ferme Test" },
      vetProfile: { fullName: "Dr Vet" },
      ...overrides
    };
  }

  it("refuse un rapport incomplet", async () => {
    const service = new VetAppointmentService(
      { vetAppointment: { findUnique: jest.fn() } } as never,
      {} as never,
      { record: jest.fn() } as never,
      { sendToUser: jest.fn() } as never,
      { notify: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    await expect(
      service.submitVisitReport(vet, "appt-1", {
        subjectsTreated: " ",
        diagnosis: "x",
        prescription: "y"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("crée le dossier Santé et notifie le producteur", async () => {
    const row = baseRow();
    const notified = jest.fn().mockResolvedValue(undefined);
    const healthCreate = jest.fn().mockResolvedValue({ id: "hr-1" });
    const detailCreate = jest.fn().mockResolvedValue({});
    const updated = {
      ...row,
      visitReportSubmittedAt: new Date(),
      visitSubjectsTreated: "Vaccination",
      visitDiagnosis: "Bonne santé",
      visitPrescription: "Rappel dans 6 mois",
      farmHealthRecordId: "hr-1",
      farm: { id: "farm-1", name: "Ferme Test", address: "Dakar" },
      producer: { id: "producer-1", fullName: "Ami", phone: null },
      vetProfile: { id: "vp-1", fullName: "Dr Vet", professionalPhone: null },
      vet: { id: "vet-1", fullName: "Dr Vet" },
      rating: null
    };

    const prisma = {
      vetAppointment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(row)
          .mockResolvedValue(updated)
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          farmHealthRecord: { create: healthCreate },
          healthVetVisitDetail: { create: detailCreate },
          vetAppointment: {
            update: jest.fn().mockResolvedValue(updated)
          }
        };
        return fn(tx);
      })
    };

    const service = new VetAppointmentService(
      prisma as never,
      {} as never,
      { record: jest.fn() } as never,
      { sendToUser: jest.fn() } as never,
      { notify: notified } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );

    const result = await service.submitVisitReport(vet, "appt-1", {
      subjectsTreated: "Vaccination",
      diagnosis: "Bonne santé",
      prescription: "Rappel dans 6 mois"
    });

    expect(result.farmHealthRecordId).toBe("hr-1");
    expect(result.visitDiagnosis).toBe("Bonne santé");
    expect(healthCreate).toHaveBeenCalled();
    expect(detailCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diagnosis: "Bonne santé",
          subjectsTreated: "Vaccination",
          prescription: "Rappel dans 6 mois",
          vetAppointmentId: "appt-1"
        })
      })
    );
    expect(notified).toHaveBeenCalledWith(
      "producer-1",
      "Rapport de visite disponible",
      expect.stringContaining("Santé"),
      expect.objectContaining({ type: "vet_appointment_report_submitted" })
    );
  });

  it("refuse un second rapport", async () => {
    const prisma = {
      vetAppointment: {
        findUnique: jest.fn().mockResolvedValue(
          baseRow({ visitReportSubmittedAt: new Date() })
        )
      }
    };
    const service = new VetAppointmentService(
      prisma as never,
      {} as never,
      { record: jest.fn() } as never,
      { sendToUser: jest.fn() } as never,
      { notify: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    await expect(
      service.submitVisitReport(vet, "appt-1", {
        subjectsTreated: "a",
        diagnosis: "b",
        prescription: "c"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
