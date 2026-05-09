import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { TaskStatus } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService
  ) {}

  private async assertAssigneeOnFarm(
    farmId: string,
    ownerId: string,
    assigneeId: string | undefined | null
  ) {
    if (!assigneeId) {
      return;
    }
    if (assigneeId === ownerId) {
      return;
    }
    const m = await this.prisma.farmMembership.findFirst({
      where: { farmId, userId: assigneeId }
    });
    if (!m) {
      throw new BadRequestException(
        "L'utilisateur assigne n'est pas membre de cette ferme"
      );
    }
  }

  async list(
    user: User,
    farmId: string,
    status?: TaskStatus
  ) {
    const farm = await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.prisma.farmTask.findMany({
      where: {
        farmId,
        ...(status ? { status } : {})
      },
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      include: {
        assignee: {
          select: { id: true, fullName: true, email: true, phone: true }
        },
        creator: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });
  }

  async create(user: User, farmId: string, dto: CreateTaskDto) {
    const farm = await this.farmAccess.requireFarmAccess(user.id, farmId);
    await this.assertAssigneeOnFarm(farmId, farm.ownerId, dto.assignedUserId);

    return this.prisma.farmTask.create({
      data: {
        farmId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        priority: dto.priority ?? "normal",
        status: dto.status ?? "todo",
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        assignedUserId: dto.assignedUserId,
        createdByUserId: user.id
      },
      include: {
        assignee: {
          select: { id: true, fullName: true, email: true, phone: true }
        }
      }
    });
  }

  async update(user: User, farmId: string, taskId: string, dto: UpdateTaskDto) {
    const farm = await this.farmAccess.requireFarmAccess(user.id, farmId);
    const task = await this.prisma.farmTask.findFirst({
      where: { id: taskId, farmId }
    });
    if (!task) {
      throw new NotFoundException("Tache introuvable");
    }

    if (dto.assignedUserId !== undefined) {
      await this.assertAssigneeOnFarm(
        farmId,
        farm.ownerId,
        dto.assignedUserId
      );
    }

    let completedAt: Date | null | undefined = undefined;
    if (dto.completedAt !== undefined) {
      completedAt = dto.completedAt ? new Date(dto.completedAt) : null;
    } else if (dto.status === TaskStatus.done && !task.completedAt) {
      completedAt = new Date();
    } else if (
      dto.status &&
      dto.status !== TaskStatus.done &&
      task.completedAt
    ) {
      completedAt = null;
    }

    return this.prisma.farmTask.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.dueAt !== undefined
          ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }
          : {}),
        ...(dto.assignedUserId !== undefined
          ? { assignedUserId: dto.assignedUserId }
          : {}),
        ...(completedAt !== undefined ? { completedAt } : {})
      },
      include: {
        assignee: {
          select: { id: true, fullName: true, email: true, phone: true }
        }
      }
    });
  }

  async remove(user: User, farmId: string, taskId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const task = await this.prisma.farmTask.findFirst({
      where: { id: taskId, farmId }
    });
    if (!task) {
      throw new NotFoundException("Tache introuvable");
    }
    await this.prisma.farmTask.delete({ where: { id: taskId } });
  }
}
