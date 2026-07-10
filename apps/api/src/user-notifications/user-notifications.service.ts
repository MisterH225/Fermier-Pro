import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, User } from "@prisma/client";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UserNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService
  ) {}

  /**
   * Persiste une notification in-app (cloche) et envoie le push Expo associé.
   * `data.type` est requis pour le deep link mobile.
   */
  async notify(
    userId: string,
    title: string,
    body: string,
    data: Record<string, string>
  ): Promise<void> {
    const type = (data.type ?? "generic").trim() || "generic";
    await this.prisma.userNotification.create({
      data: {
        userId,
        type,
        title,
        body,
        data: data as Prisma.InputJsonValue
      }
    });
    void this.push.sendToUser(userId, title, body, data);
  }

  async countUnread(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.userNotification.count({
      where: { userId, isRead: false }
    });
    return { count };
  }

  async listForUser(user: User, skip = 0, take = 50) {
    const safeTake = Math.min(100, Math.max(1, take));
    const safeSkip = Math.max(0, skip);
    const [total, rows] = await Promise.all([
      this.prisma.userNotification.count({ where: { userId: user.id } }),
      this.prisma.userNotification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        skip: safeSkip,
        take: safeTake
      })
    ]);
    return {
      total,
      items: rows.map((n) => this.serialize(n))
    };
  }

  async markRead(userId: string, notificationId: string) {
    const row = await this.prisma.userNotification.findFirst({
      where: { id: notificationId, userId }
    });
    if (!row) {
      throw new NotFoundException("Notification introuvable");
    }
    if (row.isRead) {
      return this.serialize(row);
    }
    const updated = await this.prisma.userNotification.update({
      where: { id: row.id },
      data: { isRead: true, readAt: new Date() }
    });
    return this.serialize(updated);
  }

  async deleteForUser(userId: string, notificationId: string) {
    const result = await this.prisma.userNotification.deleteMany({
      where: { id: notificationId, userId }
    });
    if (result.count === 0) {
      throw new NotFoundException("Notification introuvable");
    }
    return { ok: true };
  }

  private serialize(n: {
    id: string;
    type: string;
    title: string;
    body: string;
    data: Prisma.JsonValue | null;
    isRead: boolean;
    createdAt: Date;
    readAt: Date | null;
  }) {
    const data =
      n.data && typeof n.data === "object" && !Array.isArray(n.data)
        ? (n.data as Record<string, unknown>)
        : {};
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString() ?? null
    };
  }
}
