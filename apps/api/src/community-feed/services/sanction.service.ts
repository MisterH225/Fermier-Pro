import { Injectable, Logger } from "@nestjs/common";
import {
  AdminMessageType,
  FeedUserStatus,
  ModerationSeverity,
  type User
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { findCommunityRule } from "../constants/community-rules";

const NOTIFICATION_TEMPLATES = {
  warning_1: {
    title: "📋 Rappel des règles communautaires",
    body: "Votre publication a été modifiée ou bloquée car elle ne respectait pas entièrement nos règles de bienveillance. Nous vous invitons à consulter la charte de la communauté Fermier Pro."
  },
  warning_2: {
    title: "⚠️ Deuxième avertissement",
    body: "Vous avez reçu un deuxième avertissement. Une prochaine infraction entraînera une suspension temporaire de votre accès au Feed."
  },
  suspension_7d: {
    title: "🔴 Accès Feed suspendu — 7 jours",
    body: "Suite à plusieurs infractions à nos règles communautaires, votre accès au Feed est suspendu pour 7 jours. Vous pouvez toujours consulter les publications."
  },
  suspension_30d: {
    title: "🔴 Accès Feed suspendu — 30 jours",
    body: "Suite à des violations répétées, votre accès au Feed est suspendu pour 30 jours."
  },
  ban_permanent: {
    title: "🔴 Accès Feed suspendu définitivement",
    body: "Votre accès au Feed Fermier Pro a été définitivement suspendu suite à des violations graves et répétées de notre charte communautaire."
  }
} as const;

export type RecordViolationInput = {
  userId: string;
  postId?: string;
  commentId?: string;
  violationType: string;
  severity: ModerationSeverity;
  actionTaken: string;
  contentSnapshot: string;
  aiConfidence?: number | null;
  ruleId?: string | null;
};

@Injectable()
export class SanctionService {
  private readonly logger = new Logger(SanctionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordViolation(input: RecordViolationInput): Promise<void> {
    await this.prisma.moderationEvent.create({
      data: {
        userId: input.userId,
        postId: input.postId,
        commentId: input.commentId,
        violationType: input.violationType,
        severity: input.severity,
        actionTaken: input.actionTaken,
        contentSnapshot: input.contentSnapshot.slice(0, 4000),
        aiConfidence: input.aiConfidence ?? undefined
      }
    });

    await this.applyProgressiveSanctions(input.userId, input.severity, input.ruleId);
  }

  async applyProgressiveSanctions(
    userId: string,
    latestSeverity: ModerationSeverity,
    ruleId?: string | null
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return;
    }

    await this.maybeReduceSanctionLevel(user);

    const refreshed = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!refreshed) {
      return;
    }

    const recentCount = await this.prisma.moderationEvent.count({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });

    const highCount = await this.prisma.moderationEvent.count({
      where: {
        userId,
        severity: ModerationSeverity.high,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });

    let nextStatus = refreshed.feedStatus;
    let suspensionUntil: Date | null = refreshed.feedSuspensionUntil;

    const isSuspended =
      refreshed.feedStatus === FeedUserStatus.suspended_7d ||
      refreshed.feedStatus === FeedUserStatus.suspended_30d;

    if (isSuspended || refreshed.feedStatus === FeedUserStatus.banned_permanent) {
      if (latestSeverity === ModerationSeverity.high || recentCount >= 1) {
        if (refreshed.feedStatus === FeedUserStatus.suspended_7d) {
          nextStatus = FeedUserStatus.suspended_30d;
          suspensionUntil = this.addDays(new Date(), 30);
          await this.notify(userId, "suspension_30d", suspensionUntil, ruleId);
        } else if (
          refreshed.feedStatus === FeedUserStatus.suspended_30d ||
          refreshed.feedStatus === FeedUserStatus.banned_permanent
        ) {
          nextStatus = FeedUserStatus.banned_permanent;
          suspensionUntil = null;
          await this.notify(userId, "ban_permanent", null, ruleId);
        }
      }
    } else if (recentCount >= 5 || (highCount >= 2 && latestSeverity === ModerationSeverity.high)) {
      nextStatus = FeedUserStatus.banned_permanent;
      suspensionUntil = null;
      await this.notify(userId, "ban_permanent", null, ruleId);
    } else if (recentCount >= 4 || (highCount >= 2 && latestSeverity !== ModerationSeverity.low)) {
      nextStatus = FeedUserStatus.suspended_30d;
      suspensionUntil = this.addDays(new Date(), 30);
      await this.notify(userId, "suspension_30d", suspensionUntil, ruleId);
    } else if (recentCount >= 3 || highCount >= 1) {
      nextStatus = FeedUserStatus.suspended_7d;
      suspensionUntil = this.addDays(new Date(), 7);
      await this.notify(userId, "suspension_7d", suspensionUntil, ruleId);
    } else if (recentCount >= 2 || latestSeverity === ModerationSeverity.high) {
      nextStatus = FeedUserStatus.warned_2;
      await this.notify(userId, "warning_2", null, ruleId);
    } else if (recentCount >= 1) {
      nextStatus = FeedUserStatus.warned_1;
      await this.notify(userId, "warning_1", null, ruleId);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        feedStatus: nextStatus,
        feedSuspensionUntil: suspensionUntil,
        feedViolationCount: recentCount
      }
    });
  }

  async maybeReduceSanctionLevel(user: User): Promise<void> {
    if (!user.feedViolationLastReset) {
      return;
    }
    const daysSince =
      (Date.now() - user.feedViolationLastReset.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSince < 90) {
      return;
    }

    const reduced = this.reduceStatus(user.feedStatus);
    if (reduced === user.feedStatus) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { feedViolationLastReset: new Date() }
      });
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        feedStatus: reduced,
        feedSuspensionUntil: null,
        feedViolationLastReset: new Date(),
        feedViolationCount: Math.max(0, user.feedViolationCount - 1)
      }
    });
  }

  async setManualSanction(
    userId: string,
    feedStatus: FeedUserStatus,
    reason?: string
  ): Promise<void> {
    let suspensionUntil: Date | null = null;
    if (feedStatus === FeedUserStatus.suspended_7d) {
      suspensionUntil = this.addDays(new Date(), 7);
    } else if (feedStatus === FeedUserStatus.suspended_30d) {
      suspensionUntil = this.addDays(new Date(), 30);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        feedStatus,
        feedSuspensionUntil: suspensionUntil
      }
    });

    if (reason) {
      await this.sendInAppMessage(
        userId,
        "Sanction Feed (admin)",
        reason,
        AdminMessageType.warning
      );
    }
  }

  async clearSanction(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        feedStatus: FeedUserStatus.active,
        feedSuspensionUntil: null,
        feedViolationCount: 0,
        feedViolationLastReset: new Date()
      }
    });
  }

  canPost(user: Pick<User, "feedStatus" | "feedSuspensionUntil">): boolean {
    if (user.feedStatus === FeedUserStatus.banned_permanent) {
      return false;
    }
    if (
      user.feedStatus === FeedUserStatus.suspended_7d ||
      user.feedStatus === FeedUserStatus.suspended_30d
    ) {
      if (user.feedSuspensionUntil && user.feedSuspensionUntil > new Date()) {
        return false;
      }
    }
    return true;
  }

  canRead(user: Pick<User, "feedStatus">): boolean {
    return user.feedStatus !== FeedUserStatus.banned_permanent;
  }

  private reduceStatus(status: FeedUserStatus): FeedUserStatus {
    switch (status) {
      case FeedUserStatus.banned_permanent:
        return FeedUserStatus.suspended_30d;
      case FeedUserStatus.suspended_30d:
        return FeedUserStatus.suspended_7d;
      case FeedUserStatus.suspended_7d:
        return FeedUserStatus.warned_2;
      case FeedUserStatus.warned_2:
        return FeedUserStatus.warned_1;
      case FeedUserStatus.warned_1:
        return FeedUserStatus.active;
      default:
        return FeedUserStatus.active;
    }
  }

  private async notify(
    userId: string,
    templateKey: keyof typeof NOTIFICATION_TEMPLATES,
    suspensionUntil: Date | null,
    ruleId?: string | null
  ): Promise<void> {
    const template = NOTIFICATION_TEMPLATES[templateKey];
    const rule = findCommunityRule(ruleId);
    let body = template.body;
    if (suspensionUntil) {
      body += ` Fin de suspension : ${suspensionUntil.toISOString()}.`;
    }
    if (rule) {
      body += ` Règle concernée : ${rule.label} — ${rule.description}`;
    }

    await this.sendInAppMessage(
      userId,
      template.title,
      body,
      templateKey === "warning_1" || templateKey === "warning_2"
        ? AdminMessageType.warning
        : AdminMessageType.notification
    );
  }

  private async sendInAppMessage(
    userId: string,
    subject: string,
    message: string,
    type: AdminMessageType
  ): Promise<void> {
    const admin = await this.prisma.superAdmin.findFirst({
      select: { userId: true }
    });
    if (!admin) {
      this.logger.warn("Aucun superadmin — notification Feed non enregistrée.");
      return;
    }
    await this.prisma.adminMessage.create({
      data: {
        adminUserId: admin.userId,
        recipientUserId: userId,
        subject,
        message,
        type
      }
    });
  }

  private addDays(from: Date, days: number): Date {
    const d = new Date(from);
    d.setDate(d.getDate() + days);
    return d;
  }
}
