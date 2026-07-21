import { BadRequestException } from "@nestjs/common";
import { VetAppointmentStatus } from "@prisma/client";
import { VetAppointmentService } from "./vet-appointment.service";

describe("VetAppointmentService.producerRefuse", () => {
  const producer = { id: "producer-1", fullName: "Ami Producer" } as never;

  function baseRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "appt-1",
      farmId: "farm-1",
      producerUserId: "producer-1",
      vetProfileId: "vp-1",
      vetUserId: "vet-1",
      status: VetAppointmentStatus.VISIT_PROPOSED,
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
      paymentConfirmedAt: null,
      proposedByVetAt: new Date("2026-07-20T10:00:00.000Z"),
      completedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      conflictStatus: null,
      conflictDetails: null,
      calendarBlocked: false,
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

  it("refuse sans motif → 400", async () => {
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
      service.producerRefuse(producer, "appt-1", "  ")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("notifie le vétérinaire (inbox) avec le motif du refus", async () => {
    const row = baseRow();
    const refused = {
      ...row,
      status: VetAppointmentStatus.REFUSED_BY_PRODUCER,
      refusalReason: "Pas disponible ce jour",
      cancelledAt: new Date()
    };
    const notify = jest.fn().mockResolvedValue(undefined);
    const update = jest.fn().mockResolvedValue(refused);

    const prisma = {
      vetAppointment: {
        findUnique: jest.fn().mockResolvedValue(row)
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          vetAppointment: { update }
        };
        return fn(tx);
      })
    };

    const service = new VetAppointmentService(
      prisma as never,
      {} as never,
      { record: jest.fn() } as never,
      { sendToUser: jest.fn() } as never,
      { notify } as never,
      { unblockSlot: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );

    const result = await service.producerRefuse(
      producer,
      "appt-1",
      "Pas disponible ce jour"
    );

    expect(result.status).toBe(VetAppointmentStatus.REFUSED_BY_PRODUCER);
    expect(result.refusalReason).toBe("Pas disponible ce jour");
    expect(notify).toHaveBeenCalledWith(
      "vet-1",
      "Proposition refusée",
      expect.stringContaining("Motif : Pas disponible ce jour"),
      expect.objectContaining({
        type: "vet_appointment_refused_by_producer",
        appointmentId: "appt-1"
      })
    );
  });
});
