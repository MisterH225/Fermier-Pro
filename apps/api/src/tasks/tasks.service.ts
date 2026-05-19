import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  TaskNotificationType,
  TaskStatus,
  type Prisma
} from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { TasksGateway } from "./tasks.gateway";
import { isTaskCategory } from "./task-categories.constants";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { resolveListStatus } from "./dto/list-tasks-query.dto";

const taskInclude = {
  assignee: {
    select: { id: true, fullName: true, email: true, phone: true }
  },
  creator: {
    select: { id: true, fullName: true, email: true }
  },
  completedBy: {
    select: { id: true, fullName: true, email: true }
  },
  animal: {
    select: {
      id: true,
      publicId: true,
      tagCode: true,
      species: { select: { id: true, code: true, name: true } },
      breed: { select: { id: true, name: true } }
    }
  }
} satisfies Prisma.FarmTaskInclude;

type TaskRow = Prisma.FarmTaskGetPayload<{ include: typeof taskInclude }>;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly push: PushNotificationsService,
    private readonly tasksGateway: TasksGateway
  ) {}

  private emitTaskChange(farmId: string, task: ReturnType<typeof this.serialize>) {
    this.tasksGateway.broadcastTaskChange(farmId, {
      farmId,
      task
    });
  }

  async pendingCount(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const pendingCount = await this.prisma.farmTask.count({
      where: { farmId, status: TaskStatus.todo }
    });
    return { pendingCount };
  }

  private serialize(t: TaskRow) {
    return {
      id: t.id,
      farmId: t.farmId,
      title: t.title,
      description: t.description,
      category: t.category,
      status: t.status === TaskStatus.todo ? "pending" : t.status,
      priority:
        t.priority === "high"
          ? "urgent"
          : t.priority === "normal"
            ? "normal"
            : "low",
      dueAt: t.dueAt?.toISOString() ?? null,
      reminder: t.reminder,
      completedAt: t.completedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      assignedUserId: t.assignedUserId,
      animalId: t.animalId,
      assignee: t.assignee,
      creator: t.creator,
      completedBy: t.completedBy,
      animal: t.animal
    };
  }

  private mapStatusInput(s?: string): TaskStatus | undefined {
    if (!s) {
      return undefined;
    }
    if (s === "pending") {
      return TaskStatus.todo;
    }
    return s as TaskStatus;
  }

  private periodWhere(
    period?: string
  ): Prisma.FarmTaskWhereInput | undefined {
    if (!period || period === "all") {
      return undefined;
    }
    const now = new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    if (period === "today") {
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      return { dueAt: { gte: start, lt: end } };
    }
    if (period === "week") {
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 7);
      return { dueAt: { gte: start, lt: end } };
    }
    return undefined;
  }

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

  private async assertAnimalOnFarm(farmId: string, animalId?: string | null) {
    if (!animalId) {
      return;
    }
    const a = await this.prisma.animal.findFirst({
      where: { id: animalId, farmId }
    });
    if (!a) {
      throw new BadRequestException("Animal introuvable sur cette ferme");
    }
  }

  private async logNotification(
    taskId: string,
    userId: string,
    type: TaskNotificationType
  ) {
    await this.prisma.taskNotification.create({
      data: { taskId, userId, type }
    });
  }

  private formatDue(dueAt: Date | null | undefined): string {
    if (!dueAt) {
      return "";
    }
    return dueAt.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC"
    });
  }

  private async notifyAssigned(
    task: TaskRow,
    assigneeId: string
  ): Promise<void> {
    const due = this.formatDue(task.dueAt);
    const body = due
      ? `Nouvelle tâche assignée : ${task.title} — échéance ${due}`
      : `Nouvelle tâche assignée : ${task.title}`;
    const sent = await this.push.sendToUser(assigneeId, "Nouvelle tâche", body, {
      taskId: task.id,
      farmId: task.farmId
    });
    if (sent) {
      await this.logNotification(
        task.id,
        assigneeId,
        TaskNotificationType.assigned
      );
    }
  }

  private async notifyProducerCompleted(
    task: TaskRow,
    farmOwnerId: string,
    actorName: string
  ): Promise<void> {
    const body = `✅ ${actorName} a terminé : ${task.title}`;
    const sent = await this.push.sendToUser(
      farmOwnerId,
      "Tâche terminée",
      body,
      { taskId: task.id, farmId: task.farmId }
    );
    if (sent) {
      await this.logNotification(
        task.id,
        farmOwnerId,
        TaskNotificationType.completed
      );
    }
  }

  async list(
    user: User,
    farmId: string,
    q: {
      status?: string;
      assigned_to?: string;
      period?: string;
    }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const status = resolveListStatus(q.status);
    const periodFilter = this.periodWhere(q.period);

    const rows = await this.prisma.farmTask.findMany({
      where: {
        farmId,
        ...(status ? { status } : {}),
        ...(q.assigned_to ? { assignedUserId: q.assigned_to } : {}),
        ...(periodFilter ?? {})
      },
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      include: taskInclude
    });
    return rows.map((t) => this.serialize(t));
  }

  async getOne(user: User, farmId: string, taskId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const task = await this.prisma.farmTask.findFirst({
      where: { id: taskId, farmId },
      include: taskInclude
    });
    if (!task) {
      throw new NotFoundException("Tache introuvable");
    }
    return this.serialize(task);
  }

  async listMyDashboard(
    user: User,
    farmId: string,
    period?: string
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const periodFilter = this.periodWhere(period);
    const rows = await this.prisma.farmTask.findMany({
      where: {
        farmId,
        assignedUserId: user.id,
        status: { in: [TaskStatus.todo, TaskStatus.in_progress] },
        ...(periodFilter ?? {})
      },
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
      include: taskInclude,
      take: 20
    });
    const pendingCount = await this.prisma.farmTask.count({
      where: {
        farmId,
        assignedUserId: user.id,
        status: TaskStatus.todo
      }
    });
    return {
      pendingCount,
      tasks: rows.map((t) => this.serialize(t))
    };
  }

  async create(user: User, farmId: string, dto: CreateTaskDto) {
    const farm = await this.farmAccess.requireFarmAccess(user.id, farmId);
    if (dto.category && !isTaskCategory(dto.category)) {
      throw new BadRequestException("Categorie de tache invalide");
    }
    await this.assertAssigneeOnFarm(farmId, farm.ownerId, dto.assignedUserId);
    await this.assertAnimalOnFarm(farmId, dto.animalId);

    const status = this.mapStatusInput(dto.status as string) ?? TaskStatus.todo;

    const task = await this.prisma.farmTask.create({
      data: {
        farmId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        priority: dto.priority ?? "normal",
        status,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        reminder: dto.reminder,
        assignedUserId: dto.assignedUserId,
        animalId: dto.animalId,
        createdByUserId: user.id
      },
      include: taskInclude
    });

    if (task.assignedUserId && task.assignedUserId !== user.id) {
      await this.notifyAssigned(task, task.assignedUserId);
    }

    const out = this.serialize(task);
    this.emitTaskChange(farmId, out);
    return out;
  }

  async update(user: User, farmId: string, taskId: string, dto: UpdateTaskDto) {
    const farm = await this.farmAccess.requireFarmAccess(user.id, farmId);
    const task = await this.prisma.farmTask.findFirst({
      where: { id: taskId, farmId },
      include: taskInclude
    });
    if (!task) {
      throw new NotFoundException("Tache introuvable");
    }

    if (dto.category !== undefined && dto.category !== null) {
      if (!isTaskCategory(dto.category)) {
        throw new BadRequestException("Categorie de tache invalide");
      }
    }

    if (dto.assignedUserId !== undefined) {
      await this.assertAssigneeOnFarm(
        farmId,
        farm.ownerId,
        dto.assignedUserId
      );
    }
    if (dto.animalId !== undefined) {
      await this.assertAnimalOnFarm(farmId, dto.animalId);
    }

    const prevAssignee = task.assignedUserId;
    const prevStatus = task.status;

    let completedAt: Date | null | undefined = undefined;
    let completedByUserId: string | null | undefined = undefined;
    const nextStatus = dto.status
      ? this.mapStatusInput(dto.status as string)
      : undefined;

    if (dto.completedAt !== undefined) {
      completedAt = dto.completedAt ? new Date(dto.completedAt) : null;
    } else if (nextStatus === TaskStatus.done && !task.completedAt) {
      completedAt = new Date();
      completedByUserId = user.id;
    } else if (
      nextStatus &&
      nextStatus !== TaskStatus.done &&
      task.completedAt
    ) {
      completedAt = null;
      completedByUserId = null;
    }

    const updated = await this.prisma.farmTask.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(nextStatus !== undefined ? { status: nextStatus } : {}),
        ...(dto.dueAt !== undefined
          ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }
          : {}),
        ...(dto.reminder !== undefined ? { reminder: dto.reminder } : {}),
        ...(dto.assignedUserId !== undefined
          ? { assignedUserId: dto.assignedUserId }
          : {}),
        ...(dto.animalId !== undefined ? { animalId: dto.animalId } : {}),
        ...(completedAt !== undefined ? { completedAt } : {}),
        ...(completedByUserId !== undefined ? { completedByUserId } : {})
      },
      include: taskInclude
    });

    if (
      dto.assignedUserId &&
      dto.assignedUserId !== prevAssignee &&
      dto.assignedUserId !== user.id
    ) {
      await this.notifyAssigned(updated, dto.assignedUserId);
    }

    if (
      updated.status === TaskStatus.done &&
      prevStatus !== TaskStatus.done &&
      farm.ownerId !== user.id
    ) {
      const actorName = user.fullName ?? user.email ?? "Collaborateur";
      await this.notifyProducerCompleted(updated, farm.ownerId, actorName);
    }

    const out = this.serialize(updated);
    this.emitTaskChange(farmId, out);
    return out;
  }

  async patchStatus(
    user: User,
    farmId: string,
    taskId: string,
    status: TaskStatus
  ) {
    return this.update(user, farmId, taskId, { status });
  }

  async remove(user: User, farmId: string, taskId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const task = await this.prisma.farmTask.findFirst({
      where: { id: taskId, farmId }
    });
    if (!task) {
      throw new NotFoundException("Tache introuvable");
    }
    const isOwner = task.createdByUserId === user.id;
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!isOwner && farm?.ownerId !== user.id) {
      throw new ForbiddenException("Suppression non autorisee");
    }
    await this.prisma.farmTask.delete({ where: { id: taskId } });
    this.tasksGateway.broadcastTaskChange(farmId, {
      farmId,
      deletedTaskId: taskId
    });
  }

  /** Rappels J-1 — cron 20h. */
  async runReminderNotifications(): Promise<void> {
    const now = new Date();
    const tomorrowStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
    const tomorrowEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2)
    );
    const yesterdayEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    const reminderTasks = await this.prisma.farmTask.findMany({
      where: {
        status: { in: [TaskStatus.todo, TaskStatus.in_progress] },
        dueAt: { gte: tomorrowStart, lt: tomorrowEnd },
        reminder: { in: ["j_minus_1", "both"] },
        assignedUserId: { not: null }
      },
      include: { farm: { select: { ownerId: true } } }
    });

    for (const task of reminderTasks) {
      if (!task.assignedUserId) {
        continue;
      }
      const already = await this.prisma.taskNotification.findFirst({
        where: {
          taskId: task.id,
          userId: task.assignedUserId,
          type: TaskNotificationType.reminder,
          sentAt: { gte: tomorrowStart }
        }
      });
      if (already) {
        continue;
      }
      const sent = await this.push.sendToUser(
        task.assignedUserId,
        "Rappel tâche",
        `Rappel : ${task.title} à faire demain`,
        { taskId: task.id, farmId: task.farmId }
      );
      if (sent) {
        await this.logNotification(
          task.id,
          task.assignedUserId,
          TaskNotificationType.reminder
        );
      }
    }
  }

  /** Escalade J+1 — cron 8h. */
  async runEscalationNotifications(): Promise<void> {
    const now = new Date();
    const yesterdayEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    const overdueTasks = await this.prisma.farmTask.findMany({
      where: {
        status: { in: [TaskStatus.todo, TaskStatus.in_progress] },
        dueAt: { lt: yesterdayEnd },
        assignedUserId: { not: null }
      },
      include: { farm: { select: { ownerId: true, name: true } } }
    });

    for (const task of overdueTasks) {
      if (!task.assignedUserId) {
        continue;
      }
      const already = await this.prisma.taskNotification.findFirst({
        where: {
          taskId: task.id,
          type: TaskNotificationType.escalation,
          sentAt: { gte: todayStart }
        }
      });
      if (already) {
        continue;
      }
      await this.push.sendToUser(
        task.assignedUserId,
        "Tâche en retard",
        `Tâche en retard : ${task.title}`,
        { taskId: task.id, farmId: task.farmId }
      );
      await this.logNotification(
        task.id,
        task.assignedUserId,
        TaskNotificationType.overdue
      );

      const assignee = await this.prisma.user.findUnique({
        where: { id: task.assignedUserId },
        select: { fullName: true, email: true }
      });
      const name = assignee?.fullName ?? assignee?.email ?? "Collaborateur";
      await this.push.sendToUser(
        task.farm.ownerId,
        "Tâche en retard",
        `${name} n'a pas encore complété : ${task.title}`,
        { taskId: task.id, farmId: task.farmId }
      );
      await this.logNotification(
        task.id,
        task.farm.ownerId,
        TaskNotificationType.escalation
      );
    }
  }
}
