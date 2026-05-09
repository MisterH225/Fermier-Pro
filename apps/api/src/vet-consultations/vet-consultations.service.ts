import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { VetConsultationStatus } from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateConsultationAttachmentDto } from "./dto/create-consultation-attachment.dto";
import { CreateVetConsultationDto } from "./dto/create-vet-consultation.dto";
import { UpdateVetConsultationDto } from "./dto/update-vet-consultation.dto";

const consultationInclude = {
  openedBy: { select: { id: true, fullName: true, email: true } },
  primaryVet: { select: { id: true, fullName: true, email: true } },
  animal: {
    select: { id: true, publicId: true, tagCode: true, status: true }
  },
  attachments: {
    orderBy: { createdAt: "asc" as const },
    include: {
      uploadedBy: { select: { id: true, fullName: true } }
    }
  }
} as const;

@Injectable()
export class VetConsultationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService
  ) {}

  private closedAtForStatus(status: VetConsultationStatus): Date | null {
    if (
      status === VetConsultationStatus.resolved ||
      status === VetConsultationStatus.cancelled
    ) {
      return new Date();
    }
    return null;
  }

  async list(
    user: User,
    farmId: string,
    status?: VetConsultationStatus
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.prisma.vetConsultation.findMany({
      where: {
        farmId,
        ...(status ? { status } : {})
      },
      orderBy: { openedAt: "desc" },
      include: {
        openedBy: { select: { id: true, fullName: true } },
        primaryVet: { select: { id: true, fullName: true } },
        animal: {
          select: { id: true, publicId: true, tagCode: true }
        },
        attachments: { select: { id: true } }
      }
    });
  }

  async create(user: User, farmId: string, dto: CreateVetConsultationDto) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    let animalId: string | null = null;
    if (dto.animalId) {
      const animal = await this.prisma.animal.findFirst({
        where: { id: dto.animalId, farmId }
      });
      if (!animal) {
        throw new BadRequestException("Animal inconnu sur cette ferme");
      }
      animalId = animal.id;
    }
    const row = await this.prisma.vetConsultation.create({
      data: {
        farmId,
        animalId,
        subject: dto.subject,
        summary: dto.summary ?? null,
        openedByUserId: user.id
      },
      include: consultationInclude
    });
    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.vetConsultationCreated,
      resourceType: "VetConsultation",
      resourceId: row.id,
      metadata: {
        subject: row.subject,
        animalId: row.animalId ?? undefined,
        status: row.status
      }
    });
    return row;
  }

  async getOne(user: User, farmId: string, id: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const row = await this.prisma.vetConsultation.findFirst({
      where: { id, farmId },
      include: consultationInclude
    });
    if (!row) {
      throw new NotFoundException("Consultation introuvable");
    }
    return row;
  }

  async update(user: User, farmId: string, id: string, dto: UpdateVetConsultationDto) {
    const before = await this.getOne(user, farmId, id);
    if (dto.primaryVetUserId) {
      const vetUser = await this.prisma.user.findUnique({
        where: { id: dto.primaryVetUserId }
      });
      if (!vetUser) {
        throw new BadRequestException("Veterinaire inconnu");
      }
    }
    const nextStatus = dto.status;
    const closedAt =
      nextStatus !== undefined
        ? this.closedAtForStatus(nextStatus)
        : undefined;

    const row = await this.prisma.vetConsultation.update({
      where: { id },
      data: {
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
        ...(nextStatus !== undefined ? { status: nextStatus } : {}),
        ...(dto.primaryVetUserId !== undefined
          ? { primaryVetUserId: dto.primaryVetUserId }
          : {}),
        ...(closedAt !== undefined ? { closedAt } : {})
      },
      include: consultationInclude
    });
    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.vetConsultationUpdated,
      resourceType: "VetConsultation",
      resourceId: id,
      metadata: {
        previousStatus: before.status,
        status: row.status,
        subjectTouched: dto.subject !== undefined,
        summaryTouched: dto.summary !== undefined,
        statusTouched: dto.status !== undefined,
        primaryVetTouched: dto.primaryVetUserId !== undefined
      }
    });
    return row;
  }

  async addAttachment(
    user: User,
    farmId: string,
    consultationId: string,
    dto: CreateConsultationAttachmentDto
  ) {
    await this.getOne(user, farmId, consultationId);
    const row = await this.prisma.vetConsultationAttachment.create({
      data: {
        consultationId,
        url: dto.url,
        mimeType: dto.mimeType ?? null,
        label: dto.label ?? null,
        uploadedByUserId: user.id
      },
      include: {
        uploadedBy: { select: { id: true, fullName: true } }
      }
    });
    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.vetConsultationAttachmentAdded,
      resourceType: "VetConsultationAttachment",
      resourceId: row.id,
      metadata: {
        consultationId,
        label: row.label ?? undefined,
        mimeType: row.mimeType ?? undefined,
        urlPrefix: dto.url.length > 96 ? `${dto.url.slice(0, 96)}…` : dto.url
      }
    });
    return row;
  }
}
