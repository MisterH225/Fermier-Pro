import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { LivestockExitKind, Prisma } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLivestockExitDto } from "./dto/create-livestock-exit.dto";

const TERMINAL_ANIMAL_STATUS = new Set([
  "sold",
  "dead",
  "slaughtered",
  "transferred"
]);

@Injectable()
export class LivestockExitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService
  ) {}

  private assertSingleSubject(
    animalId?: string | null,
    batchId?: string | null
  ): "animal" | "batch" {
    const hasA = Boolean(animalId);
    const hasB = Boolean(batchId);
    if (hasA === hasB) {
      throw new BadRequestException(
        "Indiquer exactement un des champs animalId ou batchId"
      );
    }
    return hasA ? "animal" : "batch";
  }

  private statusForAnimal(kind: LivestockExitKind): string {
    switch (kind) {
      case LivestockExitKind.sale:
        return "sold";
      case LivestockExitKind.mortality:
        return "dead";
      case LivestockExitKind.slaughter:
        return "slaughtered";
      case LivestockExitKind.transfer:
        return "transferred";
      default:
        return "active";
    }
  }

  async list(
    user: User,
    farmId: string,
    filters?: { kind?: LivestockExitKind; from?: Date; to?: Date }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.prisma.livestockExit.findMany({
      where: {
        farmId,
        ...(filters?.kind ? { kind: filters.kind } : {}),
        ...(filters?.from || filters?.to
          ? {
              occurredAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {})
              }
            }
          : {})
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
      include: {
        recorder: { select: { id: true, fullName: true, email: true } },
        animal: {
          select: { id: true, publicId: true, tagCode: true, status: true }
        },
        batch: {
          select: { id: true, publicId: true, name: true, headcount: true }
        },
        toFarm: { select: { id: true, name: true } }
      }
    });
  }

  async getOne(user: User, farmId: string, id: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const row = await this.prisma.livestockExit.findFirst({
      where: { id, farmId },
      include: {
        recorder: { select: { id: true, fullName: true, email: true } },
        animal: {
          select: { id: true, publicId: true, tagCode: true, status: true }
        },
        batch: {
          select: { id: true, publicId: true, name: true, headcount: true }
        },
        toFarm: { select: { id: true, name: true } }
      }
    });
    if (!row) {
      throw new NotFoundException("Sortie introuvable");
    }
    return row;
  }

  async create(user: User, farmId: string, dto: CreateLivestockExitDto) {
    const subject = this.assertSingleSubject(dto.animalId, dto.batchId);
    await this.farmAccess.requireFarmAccess(user.id, farmId);

    if (dto.toFarmId && dto.toFarmId === farmId) {
      throw new BadRequestException("Ferme destination identique a l'origine");
    }
    if (dto.toFarmId) {
      const dest = await this.prisma.farm.findFirst({
        where: { id: dto.toFarmId }
      });
      if (!dest) {
        throw new BadRequestException("Ferme destination inconnue");
      }
    }

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();

    if (subject === "animal") {
      const animal = await this.prisma.animal.findFirst({
        where: { id: dto.animalId!, farmId }
      });
      if (!animal) {
        throw new BadRequestException("Animal inconnu sur cette ferme");
      }
      if (TERMINAL_ANIMAL_STATUS.has(animal.status)) {
        throw new BadRequestException("Animal deja sorti du cheptel actif");
      }

      const exit = await this.prisma.$transaction(async (tx) => {
        const row = await tx.livestockExit.create({
          data: {
            farmId,
            animalId: animal.id,
            kind: dto.kind,
            occurredAt,
            recordedByUserId: user.id,
            headcountAffected: 1,
            buyerName: dto.buyerName ?? null,
            price:
              dto.price != null ? new Prisma.Decimal(dto.price) : null,
            currency: dto.currency ?? (dto.price != null ? "XOF" : null),
            weightKg:
              dto.weightKg != null
                ? new Prisma.Decimal(dto.weightKg)
                : null,
            invoiceRef: dto.invoiceRef ?? null,
            deathCause: dto.deathCause ?? null,
            symptoms: dto.symptoms ?? null,
            carcassYieldNote: dto.carcassYieldNote ?? null,
            slaughterDestination: dto.slaughterDestination ?? null,
            transferDestination: dto.transferDestination ?? null,
            toFarmId: dto.toFarmId ?? null,
            note: dto.note ?? null
          }
        });
        await tx.animal.update({
          where: { id: animal.id },
          data: { status: this.statusForAnimal(dto.kind) }
        });
        await tx.penPlacement.updateMany({
          where: {
            animalId: animal.id,
            endedAt: null,
            pen: { barn: { farmId } }
          },
          data: { endedAt: new Date() }
        });
        return row;
      });

      return this.getOne(user, farmId, exit.id);
    }

    const batch = await this.prisma.livestockBatch.findFirst({
      where: { id: dto.batchId!, farmId }
    });
    if (!batch) {
      throw new BadRequestException("Bande inconnue sur cette ferme");
    }
    if (batch.status === "closed" || batch.headcount <= 0) {
      throw new BadRequestException("Bande vide ou deja cloturee");
    }

    const n =
      dto.headcountAffected != null ? dto.headcountAffected : batch.headcount;
    if (n < 1 || n > batch.headcount) {
      throw new BadRequestException("Effectif a retirer incoherent");
    }

    const exit = await this.prisma.$transaction(async (tx) => {
      const row = await tx.livestockExit.create({
        data: {
          farmId,
          batchId: batch.id,
          kind: dto.kind,
          occurredAt,
          recordedByUserId: user.id,
          headcountAffected: n,
          buyerName: dto.buyerName ?? null,
          price: dto.price != null ? new Prisma.Decimal(dto.price) : null,
          currency: dto.currency ?? (dto.price != null ? "XOF" : null),
          weightKg:
            dto.weightKg != null
              ? new Prisma.Decimal(dto.weightKg)
              : null,
          invoiceRef: dto.invoiceRef ?? null,
          deathCause: dto.deathCause ?? null,
          symptoms: dto.symptoms ?? null,
          carcassYieldNote: dto.carcassYieldNote ?? null,
          slaughterDestination: dto.slaughterDestination ?? null,
          transferDestination: dto.transferDestination ?? null,
          toFarmId: dto.toFarmId ?? null,
          note: dto.note ?? null
        }
      });
      const newHead = batch.headcount - n;
      await tx.livestockBatch.update({
        where: { id: batch.id },
        data: {
          headcount: newHead,
          ...(newHead <= 0 ? { status: "closed" } : {})
        }
      });
      if (newHead <= 0) {
        await tx.penPlacement.updateMany({
          where: {
            batchId: batch.id,
            endedAt: null,
            pen: { barn: { farmId } }
          },
          data: { endedAt: new Date() }
        });
      }
      return row;
    });

    return this.getOne(user, farmId, exit.id);
  }
}
