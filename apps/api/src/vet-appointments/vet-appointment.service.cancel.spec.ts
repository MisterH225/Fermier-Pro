import { BadRequestException } from "@nestjs/common";
import { VetAppointmentStatus } from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { VetAppointmentService } from "./vet-appointment.service";

describe("VetAppointmentService.cancel", () => {
  const producer = { id: "producer-1", fullName: "Ami Producer" } as never;
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
      proposedByVetAt: new Date("2026-07-20T10:00:00.000Z"),
      completedAt: null,
      cancelledAt: null,
      cancellationReason: null,
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
    const creditVetRefund = jest.fn().mockResolvedValue(undefined);
    const sendToUser = jest.fn().mockResolvedValue(undefined);
    const auditRecord = jest.fn().mockResolvedValue(undefined);
    const unblockSlot = jest.fn().mockResolvedValue(undefined);
    const fundCreate = jest.fn().mockResolvedValue({});

    const cancelledRow = {
      ...row,
      status:
        row.producerUserId === "producer-1" && row.status
          ? VetAppointmentStatus.CANCELLED_BY_PRODUCER
          : VetAppointmentStatus.CANCELLED_BY_VET,
      cancelledAt: new Date("2026-07-29T12:00:00.000Z"),
      cancellationReason: "Empêchement familial"
    };

    const prisma = {
      vetAppointment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(row)
          .mockResolvedValue(cancelledRow)
      },
      vetAppointmentFundMovement: { create: fundCreate },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          vetAppointment: {
            update: jest.fn().mockResolvedValue(cancelledRow)
          },
          vetProfile: {
            update: jest.fn().mockResolvedValue({})
          },
          user: {
            update: jest.fn().mockResolvedValue({})
          }
        };
        return fn(tx);
      })
    };

    const service = new VetAppointmentService(
      prisma as never,
      {} as never,
      { record: auditRecord } as never,
      { sendToUser } as never,
      { unblockSlot } as never,
      {} as never,
      { getVetCommissionRate: jest.fn().mockResolvedValue(0.05) } as never,
      {} as never,
      { creditVetRefund } as never,
      { trackFireAndForget: jest.fn() } as never
    );

    return {
      service,
      prisma,
      creditVetRefund,
      sendToUser,
      auditRecord,
      unblockSlot,
      fundCreate
    };
  }

  it("refuse l'annulation sans motif", async () => {
    const { service } = buildService(baseRow());
    await expect(
      service.cancelByProducer(producer, "appt-1", "   ")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("producteur annule un RDV payé — remboursement + note exposée", async () => {
    const {
      service,
      creditVetRefund,
      sendToUser,
      auditRecord,
      unblockSlot,
      fundCreate
    } = buildService(baseRow());

    const result = await service.cancelByProducer(
      producer,
      "appt-1",
      "Empêchement familial"
    );

    expect(result.status).toBe(VetAppointmentStatus.CANCELLED_BY_PRODUCER);
    expect(result.cancellationReason).toBe("Empêchement familial");
    expect(result.cancelledAt).toBeTruthy();
    expect(creditVetRefund).toHaveBeenCalledWith(
      "producer-1",
      25000,
      "XOF",
      "appt-1",
      expect.any(String),
      "vet-refund:appt-1:cancel-producer"
    );
    expect(fundCreate).toHaveBeenCalled();
    expect(unblockSlot).toHaveBeenCalled();
    expect(sendToUser).toHaveBeenCalledWith(
      "vet-1",
      "RDV annulé",
      expect.stringContaining("Motif : Empêchement familial"),
      expect.objectContaining({ type: "vet_appointment_cancelled_producer" })
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTION.vetAppointmentCancelled,
        metadata: expect.objectContaining({
          by: "producer",
          wasPaid: true,
          refundAmount: 25000
        })
      })
    );
  });

  it("vétérinaire annule un RDV payé — remboursement producteur + note", async () => {
    const row = baseRow();
    const cancelledRow = {
      ...row,
      status: VetAppointmentStatus.CANCELLED_BY_VET,
      cancelledAt: new Date("2026-07-29T12:00:00.000Z"),
      cancellationReason: "Urgence clinique"
    };

    const creditVetRefund = jest.fn().mockResolvedValue(undefined);
    const sendToUser = jest.fn().mockResolvedValue(undefined);
    const auditRecord = jest.fn().mockResolvedValue(undefined);
    const unblockSlot = jest.fn().mockResolvedValue(undefined);

    const prisma = {
      vetAppointment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(row)
          .mockResolvedValue(cancelledRow)
      },
      vetAppointmentFundMovement: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          vetAppointment: {
            update: jest.fn().mockResolvedValue(cancelledRow)
          },
          vetProfile: { update: jest.fn().mockResolvedValue({}) },
          user: { update: jest.fn().mockResolvedValue({}) }
        };
        return fn(tx);
      })
    };

    const service = new VetAppointmentService(
      prisma as never,
      {} as never,
      { record: auditRecord } as never,
      { sendToUser } as never,
      { unblockSlot } as never,
      {} as never,
      { getVetCommissionRate: jest.fn().mockResolvedValue(0.05) } as never,
      {} as never,
      { creditVetRefund } as never,
      { trackFireAndForget: jest.fn() } as never
    );

    const result = await service.cancelByVet(vet, "appt-1", "Urgence clinique");

    expect(result.status).toBe(VetAppointmentStatus.CANCELLED_BY_VET);
    expect(result.cancellationReason).toBe("Urgence clinique");
    expect(creditVetRefund).toHaveBeenCalledWith(
      "producer-1",
      25000,
      "XOF",
      "appt-1",
      expect.any(String),
      "vet-refund:appt-1:cancel-vet"
    );
    expect(sendToUser).toHaveBeenCalledWith(
      "producer-1",
      "RDV annulé",
      expect.stringContaining("Motif : Urgence clinique"),
      expect.objectContaining({ type: "vet_appointment_cancelled_vet" })
    );
  });

  it("annulation gratuite sans remboursement mais avec note", async () => {
    const { service, creditVetRefund, sendToUser } = buildService(
      baseRow({
        isFree: true,
        servicePrice: null,
        blockedAmount: null,
        paymentConfirmedAt: null
      })
    );

    const result = await service.cancelByProducer(
      producer,
      "appt-1",
      "Changement de planning"
    );

    expect(result.status).toBe(VetAppointmentStatus.CANCELLED_BY_PRODUCER);
    expect(creditVetRefund).not.toHaveBeenCalled();
    expect(sendToUser).toHaveBeenCalledWith(
      "vet-1",
      "RDV annulé",
      expect.stringContaining("Motif : Changement de planning"),
      expect.any(Object)
    );
  });
});
