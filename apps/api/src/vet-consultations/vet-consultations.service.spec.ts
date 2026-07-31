import { VetConsultationStatus } from "@prisma/client";
import { VetConsultationsService } from "./vet-consultations.service";
import type { AuditService } from "../common/audit.service";
import type { FarmAccessService } from "../common/farm-access.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { UserNotificationsService } from "../user-notifications/user-notifications.service";

describe("VetConsultationsService.update — annulation composition", () => {
  const vet = { id: "vet-1", fullName: "Dr Vet" } as never;
  const farmId = "farm-1";
  const consultationId = "consult-1";

  const openConsultation = {
    id: consultationId,
    farmId,
    subject: "Validation composition — Finition",
    summary: "Revue",
    status: VetConsultationStatus.open,
    closedAt: null,
    openedByUserId: "prod-1",
    primaryVetUserId: "vet-1",
    animalId: null,
    openedAt: new Date(),
    openedBy: { id: "prod-1", fullName: "Prod", email: null },
    primaryVet: { id: "vet-1", fullName: "Dr Vet", email: null },
    animal: null,
    attachments: []
  };

  function build() {
    const prisma = {
      vetConsultation: {
        findFirst: jest.fn().mockResolvedValue(openConsultation),
        update: jest.fn().mockResolvedValue({
          ...openConsultation,
          status: VetConsultationStatus.cancelled,
          closedAt: new Date()
        })
      },
      chatRoom: {
        findFirst: jest.fn().mockResolvedValue({
          id: "room-1",
          savedCompositionId: "comp-1"
        })
      },
      savedComposition: {
        findUnique: jest.fn().mockResolvedValue({
          id: "comp-1",
          farmId,
          createdByUserId: "prod-1",
          status: "vet_review"
        }),
        update: jest.fn().mockResolvedValue({
          id: "comp-1",
          status: "draft"
        })
      },
      chatMessage: {
        create: jest.fn().mockResolvedValue({ id: "msg-1" })
      },
      farm: {
        findUnique: jest.fn().mockResolvedValue({ name: "Ferme A" })
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ fullName: "Dr Vet" })
      }
    };
    const farmAccess = {
      requireFarmAccess: jest.fn().mockResolvedValue({ id: farmId })
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const notifications = {
      notify: jest.fn().mockResolvedValue(undefined)
    };

    const service = new VetConsultationsService(
      prisma as unknown as PrismaService,
      farmAccess as unknown as FarmAccessService,
      audit as unknown as AuditService,
      notifications as unknown as UserNotificationsService
    );

    return { service, prisma, notifications, audit };
  }

  it("annule le dossier → remet la composition en draft + notifie le producteur", async () => {
    const { service, prisma, notifications } = build();

    const out = await service.update(vet, farmId, consultationId, {
      status: VetConsultationStatus.cancelled
    });

    expect(out.status).toBe(VetConsultationStatus.cancelled);
    expect(prisma.savedComposition.update).toHaveBeenCalledWith({
      where: { id: "comp-1" },
      data: {
        status: "draft",
        vetComment: null,
        vetReviewedBy: null,
        vetReviewedAt: null
      }
    });
    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roomId: "room-1",
          senderUserId: "vet-1"
        })
      })
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      "prod-1",
      "Validation de composition annulée",
      expect.any(String),
      expect.objectContaining({
        type: "feed_composition_review_cancelled",
        compositionId: "comp-1",
        farmId,
        roomId: "room-1",
        consultationId
      })
    );
  });

  it("ne touche pas une composition déjà validée", async () => {
    const { service, prisma, notifications } = build();
    prisma.savedComposition.findUnique.mockResolvedValue({
      id: "comp-1",
      farmId,
      createdByUserId: "prod-1",
      status: "validated"
    });

    await service.update(vet, farmId, consultationId, {
      status: VetConsultationStatus.cancelled
    });

    expect(prisma.savedComposition.update).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("sans salon composition lié → pas d'effet de bord", async () => {
    const { service, prisma, notifications } = build();
    prisma.chatRoom.findFirst.mockResolvedValue(null);

    await service.update(vet, farmId, consultationId, {
      status: VetConsultationStatus.cancelled
    });

    expect(prisma.savedComposition.update).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("passage à resolved → pas de reset composition", async () => {
    const { service, prisma, notifications } = build();
    prisma.vetConsultation.update.mockResolvedValue({
      ...openConsultation,
      status: VetConsultationStatus.resolved,
      closedAt: new Date()
    });

    await service.update(vet, farmId, consultationId, {
      status: VetConsultationStatus.resolved
    });

    expect(prisma.chatRoom.findFirst).not.toHaveBeenCalled();
    expect(prisma.savedComposition.update).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
