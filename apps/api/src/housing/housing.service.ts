import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBarnDto } from "./dto/create-barn.dto";
import { CreatePenDto } from "./dto/create-pen.dto";
import { CreatePenLogDto } from "./dto/create-pen-log.dto";
import { EndPenPlacementDto } from "./dto/end-pen-placement.dto";
import { PenMoveDto } from "./dto/pen-move.dto";
import { StartPenPlacementDto } from "./dto/start-pen-placement.dto";
import { UpdateBarnDto } from "./dto/update-barn.dto";
import { UpdatePenDto } from "./dto/update-pen.dto";

@Injectable()
export class HousingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService
  ) {}

  private assertSingleOccupant(
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

  private async requireBarnInFarm(
    userId: string,
    farmId: string,
    barnId: string
  ) {
    await this.farmAccess.requireFarmAccess(userId, farmId);
    const barn = await this.prisma.barn.findFirst({
      where: { id: barnId, farmId }
    });
    if (!barn) {
      throw new NotFoundException("Batiment introuvable");
    }
    return barn;
  }

  async requirePenInFarm(userId: string, farmId: string, penId: string) {
    await this.farmAccess.requireFarmAccess(userId, farmId);
    const pen = await this.prisma.pen.findFirst({
      where: { id: penId, barn: { farmId } },
      include: { barn: true }
    });
    if (!pen) {
      throw new NotFoundException("Loge introuvable");
    }
    return pen;
  }

  private async closeActiveForAnimalOnFarm(
    farmId: string,
    animalId: string
  ) {
    await this.prisma.penPlacement.updateMany({
      where: {
        animalId,
        endedAt: null,
        pen: { barn: { farmId } }
      },
      data: { endedAt: new Date() }
    });
  }

  private async closeActiveForBatchOnFarm(farmId: string, batchId: string) {
    await this.prisma.penPlacement.updateMany({
      where: {
        batchId,
        endedAt: null,
        pen: { barn: { farmId } }
      },
      data: { endedAt: new Date() }
    });
  }

  async listBarns(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.prisma.barn.findMany({
      where: { farmId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { pens: true } }
      }
    });
  }

  async createBarn(user: User, farmId: string, dto: CreateBarnDto) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.prisma.barn.create({
      data: {
        farmId,
        name: dto.name,
        code: dto.code,
        notes: dto.notes,
        sortOrder: dto.sortOrder ?? 0
      }
    });
  }

  async getBarn(user: User, farmId: string, barnId: string) {
    await this.requireBarnInFarm(user.id, farmId, barnId);
    return this.prisma.barn.findFirst({
      where: { id: barnId, farmId },
      include: {
        pens: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            _count: {
              select: {
                placements: { where: { endedAt: null } }
              }
            }
          }
        }
      }
    });
  }

  async updateBarn(user: User, farmId: string, barnId: string, dto: UpdateBarnDto) {
    await this.requireBarnInFarm(user.id, farmId, barnId);
    return this.prisma.barn.update({
      where: { id: barnId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {})
      }
    });
  }

  async deleteBarn(user: User, farmId: string, barnId: string) {
    await this.requireBarnInFarm(user.id, farmId, barnId);
    await this.prisma.barn.delete({ where: { id: barnId } });
  }

  async listPens(user: User, farmId: string, barnId: string) {
    await this.requireBarnInFarm(user.id, farmId, barnId);
    return this.prisma.pen.findMany({
      where: { barnId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { placements: { where: { endedAt: null } } }
        }
      }
    });
  }

  async createPen(user: User, farmId: string, barnId: string, dto: CreatePenDto) {
    await this.requireBarnInFarm(user.id, farmId, barnId);
    return this.prisma.pen.create({
      data: {
        barnId,
        name: dto.name,
        code: dto.code,
        zoneLabel: dto.zoneLabel,
        capacity: dto.capacity,
        status: dto.status ?? "active",
        sortOrder: dto.sortOrder ?? 0
      }
    });
  }

  async getPenDetail(user: User, farmId: string, penId: string) {
    await this.requirePenInFarm(user.id, farmId, penId);
    return this.prisma.pen.findFirst({
      where: { id: penId, barn: { farmId } },
      include: {
        barn: { select: { id: true, name: true, farmId: true } },
        placements: {
          where: { endedAt: null },
          include: {
            animal: {
              select: {
                id: true,
                publicId: true,
                tagCode: true,
                status: true
              }
            },
            batch: {
              select: {
                id: true,
                publicId: true,
                name: true,
                headcount: true,
                status: true
              }
            }
          }
        },
        logs: {
          orderBy: { recordedAt: "desc" },
          take: 20,
          include: {
            recorder: { select: { id: true, fullName: true } }
          }
        }
      }
    });
  }

  async updatePen(user: User, farmId: string, penId: string, dto: UpdatePenDto) {
    await this.requirePenInFarm(user.id, farmId, penId);
    return this.prisma.pen.update({
      where: { id: penId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.zoneLabel !== undefined ? { zoneLabel: dto.zoneLabel } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {})
      }
    });
  }

  async deletePen(user: User, farmId: string, penId: string) {
    await this.requirePenInFarm(user.id, farmId, penId);
    await this.prisma.pen.delete({ where: { id: penId } });
  }

  async listPlacements(
    user: User,
    farmId: string,
    penId: string,
    activeOnly?: boolean
  ) {
    await this.requirePenInFarm(user.id, farmId, penId);
    return this.prisma.penPlacement.findMany({
      where: {
        penId,
        ...(activeOnly ? { endedAt: null } : {})
      },
      orderBy: { startedAt: "desc" },
      take: activeOnly ? 50 : 100,
      include: {
        animal: {
          select: { id: true, publicId: true, tagCode: true }
        },
        batch: {
          select: { id: true, publicId: true, name: true, headcount: true }
        },
        creator: { select: { id: true, fullName: true } }
      }
    });
  }

  async startPlacement(
    user: User,
    farmId: string,
    penId: string,
    dto: StartPenPlacementDto
  ) {
    const kind = this.assertSingleOccupant(dto.animalId, dto.batchId);
    await this.requirePenInFarm(user.id, farmId, penId);

    if (kind === "animal") {
      const animal = await this.prisma.animal.findFirst({
        where: { id: dto.animalId!, farmId }
      });
      if (!animal) {
        throw new BadRequestException("Animal inconnu sur cette ferme");
      }
      await this.closeActiveForAnimalOnFarm(farmId, animal.id);
    } else {
      const batch = await this.prisma.livestockBatch.findFirst({
        where: { id: dto.batchId!, farmId }
      });
      if (!batch) {
        throw new BadRequestException("Bande inconnue sur cette ferme");
      }
      await this.closeActiveForBatchOnFarm(farmId, batch.id);
    }

    return this.prisma.penPlacement.create({
      data: {
        penId,
        animalId: kind === "animal" ? dto.animalId! : null,
        batchId: kind === "batch" ? dto.batchId! : null,
        note: dto.note ?? null,
        createdByUserId: user.id
      },
      include: {
        animal: {
          select: { id: true, publicId: true, tagCode: true }
        },
        batch: {
          select: { id: true, publicId: true, name: true, headcount: true }
        }
      }
    });
  }

  async endPlacement(
    user: User,
    farmId: string,
    penId: string,
    dto: EndPenPlacementDto
  ) {
    const kind = this.assertSingleOccupant(dto.animalId, dto.batchId);
    await this.requirePenInFarm(user.id, farmId, penId);

    const placement = await this.prisma.penPlacement.findFirst({
      where: {
        penId,
        endedAt: null,
        ...(kind === "animal"
          ? { animalId: dto.animalId! }
          : { batchId: dto.batchId! })
      }
    });
    if (!placement) {
      throw new NotFoundException("Aucune occupation active correspondante");
    }
    return this.prisma.penPlacement.update({
      where: { id: placement.id },
      data: { endedAt: new Date() }
    });
  }

  async moveOccupant(user: User, farmId: string, dto: PenMoveDto) {
    const kind = this.assertSingleOccupant(dto.animalId, dto.batchId);
    await this.requirePenInFarm(user.id, farmId, dto.toPenId);

    if (dto.fromPenId) {
      await this.requirePenInFarm(user.id, farmId, dto.fromPenId);
    }

    if (kind === "animal") {
      const animal = await this.prisma.animal.findFirst({
        where: { id: dto.animalId!, farmId }
      });
      if (!animal) {
        throw new BadRequestException("Animal inconnu sur cette ferme");
      }
    } else {
      const batch = await this.prisma.livestockBatch.findFirst({
        where: { id: dto.batchId!, farmId }
      });
      if (!batch) {
        throw new BadRequestException("Bande inconnue sur cette ferme");
      }
    }

    const whereActive: Prisma.PenPlacementWhereInput = {
      endedAt: null,
      pen: { barn: { farmId } },
      ...(kind === "animal" ? { animalId: dto.animalId! } : { batchId: dto.batchId! }),
      ...(dto.fromPenId ? { penId: dto.fromPenId } : {})
    };

    const toClose = await this.prisma.penPlacement.findMany({
      where: whereActive
    });
    if (toClose.length === 0) {
      throw new NotFoundException("Aucune occupation active a deplacer");
    }

    await this.prisma.$transaction(async (tx) => {
      for (const p of toClose) {
        await tx.penPlacement.update({
          where: { id: p.id },
          data: { endedAt: new Date() }
        });
      }
      await tx.penPlacement.create({
        data: {
          penId: dto.toPenId,
          animalId: kind === "animal" ? dto.animalId! : null,
          batchId: kind === "batch" ? dto.batchId! : null,
          note: dto.note ?? null,
          createdByUserId: user.id
        }
      });
    });

    return this.prisma.penPlacement.findFirst({
      where: {
        penId: dto.toPenId,
        endedAt: null,
        ...(kind === "animal"
          ? { animalId: dto.animalId! }
          : { batchId: dto.batchId! })
      },
      include: {
        pen: { select: { id: true, name: true } },
        animal: {
          select: { id: true, publicId: true, tagCode: true }
        },
        batch: {
          select: { id: true, publicId: true, name: true, headcount: true }
        }
      }
    });
  }

  async listPenLogs(user: User, farmId: string, penId: string) {
    await this.requirePenInFarm(user.id, farmId, penId);
    return this.prisma.penLog.findMany({
      where: { penId },
      orderBy: { recordedAt: "desc" },
      take: 100,
      include: {
        recorder: { select: { id: true, fullName: true } }
      }
    });
  }

  async createPenLog(
    user: User,
    farmId: string,
    penId: string,
    dto: CreatePenLogDto
  ) {
    await this.requirePenInFarm(user.id, farmId, penId);
    return this.prisma.penLog.create({
      data: {
        penId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
        recordedByUserId: user.id
      },
      include: {
        recorder: { select: { id: true, fullName: true } }
      }
    });
  }
}
