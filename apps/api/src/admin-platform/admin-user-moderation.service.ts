import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  AccountStatus,
  AdminAuditAction,
  AdminAuditTargetType,
  AdminMessageType,
  ProfileModerationStatus,
  ProfileType,
  Prisma
} from "@prisma/client";
import { AccountDeletionService } from "../auth/account-deletion.service";
import { PrismaService } from "../prisma/prisma.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import {
  ModerationScopeDto,
  type BanUserDto,
  type BulkAdminMessageDto,
  type DeleteAccountAdminDto,
  type DeleteProfileAdminDto,
  type SendAdminMessageDto,
  type SuspendUserDto,
  type UnbanUserDto,
  type UnsuspendUserDto,
  type WarnUserDto
} from "./dto/admin-user-moderation.dto";

function parseSuspensionUntil(duration: string): Date | null {
  const d = duration.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (d.includes("indefin")) {
    return null;
  }
  const until = new Date();
  if (d.includes("24")) {
    until.setHours(until.getHours() + 24);
    return until;
  }
  if (d.includes("7")) {
    until.setDate(until.getDate() + 7);
    return until;
  }
  if (d.includes("30")) {
    until.setDate(until.getDate() + 30);
    return until;
  }
  return null;
}

function profileTypeToAuditTarget(type: ProfileType): AdminAuditTargetType {
  switch (type) {
    case ProfileType.veterinarian:
      return AdminAuditTargetType.vet_profile;
    case ProfileType.producer:
      return AdminAuditTargetType.farm_profile;
    case ProfileType.buyer:
      return AdminAuditTargetType.buyer_profile;
    case ProfileType.technician:
      return AdminAuditTargetType.technician_profile;
    default:
      return AdminAuditTargetType.account;
  }
}

function scopeToProfileType(scope: ModerationScopeDto): ProfileType | null {
  switch (scope) {
    case ModerationScopeDto.veterinarian:
      return ProfileType.veterinarian;
    case ModerationScopeDto.producer:
      return ProfileType.producer;
    case ModerationScopeDto.technician:
      return ProfileType.technician;
    case ModerationScopeDto.buyer:
      return ProfileType.buyer;
    default:
      return null;
  }
}

@Injectable()
export class AdminUserModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService,
    private readonly accountDeletion: AccountDeletionService
  ) {}

  private fullReason(reason: string, details?: string) {
    const parts = [reason.trim()];
    if (details?.trim()) {
      parts.push(details.trim());
    }
    return parts.join(" — ");
  }

  private async logAction(input: {
    adminUserId: string;
    targetUserId: string;
    targetProfileType: AdminAuditTargetType;
    targetProfileId?: string | null;
    action: AdminAuditAction;
    reason?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.adminAuditLog.create({
      data: {
        adminUserId: input.adminUserId,
        targetUserId: input.targetUserId,
        targetProfileType: input.targetProfileType,
        targetProfileId: input.targetProfileId ?? null,
        action: input.action,
        reason: input.reason ?? null,
        metadata: input.metadata ?? undefined
      }
    });
  }

  /**
   * Notifie l'utilisateur d'une action de modération :
   *  - crée toujours un `AdminMessage` (visible in-app, indépendant du push),
   *  - envoie un push si l'utilisateur a `notificationsEnabled = true`.
   * Le toggle `notifyUser` côté admin contrôle l'envoi global (défaut : true).
   */
  private async notifyUser(input: {
    adminUserId: string;
    userId: string;
    title: string;
    body: string;
    type?: AdminMessageType;
    notify: boolean | undefined;
  }) {
    if (input.notify === false) {
      return;
    }
    await this.prisma.adminMessage.create({
      data: {
        adminUserId: input.adminUserId,
        recipientUserId: input.userId,
        subject: input.title,
        message: input.body,
        type: input.type ?? AdminMessageType.notification
      }
    });
    await this.push.sendToUser(input.userId, input.title, input.body, {
      type: "admin_moderation"
    });
  }

  private async getUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Utilisateur introuvable");
    }
    return user;
  }

  async suspendUser(adminId: string, userId: string, dto: SuspendUserDto) {
    const user = await this.getUserOrThrow(userId);
    const reason = this.fullReason(dto.reason, dto.details);
    const until = parseSuspensionUntil(dto.duration);

    if (dto.scope === ModerationScopeDto.account) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          accountStatus: AccountStatus.suspended,
          isActive: false,
          suspendedAt: new Date(),
          suspendedReason: reason,
          suspendedUntil: until,
          bannedAt: null,
          bannedReason: null
        }
      });
      await this.prisma.profile.updateMany({
        where: { userId },
        data: {
          profileStatus: ProfileModerationStatus.suspended,
          profileSuspendedAt: new Date(),
          profileSuspendedReason: reason
        }
      });
      await this.logAction({
        adminUserId: adminId,
        targetUserId: userId,
        targetProfileType: AdminAuditTargetType.account,
        action: AdminAuditAction.suspend,
        reason,
        metadata: { scope: dto.scope, duration: dto.duration, until: until?.toISOString() ?? null }
      });
      await this.notifyUser({
        adminUserId: adminId,
        userId,
        title: "Compte suspendu",
        body: reason.slice(0, 500),
        type: AdminMessageType.warning,
        notify: dto.notifyUser
      });
      return { ok: true };
    }

    const pt = scopeToProfileType(dto.scope);
    if (!pt) {
      throw new BadRequestException("Scope profil invalide");
    }
    const profile = await this.prisma.profile.findUnique({
      where: { userId_type: { userId, type: pt } }
    });
    if (!profile) {
      throw new NotFoundException("Profil introuvable pour cet utilisateur");
    }
    await this.prisma.profile.update({
      where: { id: profile.id },
      data: {
        profileStatus: ProfileModerationStatus.suspended,
        profileSuspendedAt: new Date(),
        profileSuspendedReason: reason
      }
    });
    if (pt === ProfileType.veterinarian) {
      await this.prisma.vetProfile.updateMany({
        where: { userId },
        data: { availability: false }
      });
    }
    await this.logAction({
      adminUserId: adminId,
      targetUserId: userId,
      targetProfileType: profileTypeToAuditTarget(pt),
      targetProfileId: profile.id,
      action: AdminAuditAction.suspend,
      reason,
      metadata: { scope: dto.scope, duration: dto.duration, until: until?.toISOString() ?? null }
    });
    await this.notifyUser({
      adminUserId: adminId,
      userId,
      title: "Profil suspendu",
      body: reason.slice(0, 500),
      type: AdminMessageType.warning,
      notify: dto.notifyUser
    });
    return { ok: true, profileId: profile.id };
  }

  async unsuspendUser(adminId: string, userId: string, dto: UnsuspendUserDto) {
    await this.getUserOrThrow(userId);

    if (dto.scope === ModerationScopeDto.account) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          accountStatus: AccountStatus.active,
          isActive: true,
          suspendedAt: null,
          suspendedReason: null,
          suspendedUntil: null
        }
      });
      await this.prisma.profile.updateMany({
        where: { userId },
        data: {
          profileStatus: ProfileModerationStatus.active,
          profileSuspendedAt: null,
          profileSuspendedReason: null
        }
      });
      await this.logAction({
        adminUserId: adminId,
        targetUserId: userId,
        targetProfileType: AdminAuditTargetType.account,
        action: AdminAuditAction.unsuspend,
        reason: dto.note ?? null
      });
      await this.notifyUser({
        adminUserId: adminId,
        userId,
        title: "Compte réactivé",
        body: dto.note?.trim()
          ? `Votre compte a été réactivé. ${dto.note}`
          : "Votre compte a été réactivé.",
        type: AdminMessageType.info,
        notify: dto.notifyUser
      });
      return { ok: true };
    }

    const pt = scopeToProfileType(dto.scope);
    if (!pt) {
      throw new BadRequestException("Scope profil invalide");
    }
    const profile = await this.prisma.profile.findUnique({
      where: { userId_type: { userId, type: pt } }
    });
    if (!profile) {
      throw new NotFoundException("Profil introuvable");
    }
    await this.prisma.profile.update({
      where: { id: profile.id },
      data: {
        profileStatus: ProfileModerationStatus.active,
        profileSuspendedAt: null,
        profileSuspendedReason: null
      }
    });
    if (pt === ProfileType.veterinarian) {
      await this.prisma.vetProfile.updateMany({
        where: { userId },
        data: { availability: true }
      });
    }
    await this.logAction({
      adminUserId: adminId,
      targetUserId: userId,
      targetProfileType: profileTypeToAuditTarget(pt),
      targetProfileId: profile.id,
      action: AdminAuditAction.unsuspend,
      reason: dto.note ?? null
    });
    await this.notifyUser({
      adminUserId: adminId,
      userId,
      title: "Profil réactivé",
      body: "Votre profil a été réactivé.",
      type: AdminMessageType.info,
      notify: dto.notifyUser
    });
    return { ok: true };
  }

  async banUser(adminId: string, userId: string, dto: BanUserDto) {
    const reason = this.fullReason(dto.reason, dto.details);
    await this.getUserOrThrow(userId);

    if (dto.scope === ModerationScopeDto.account) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          accountStatus: AccountStatus.banned,
          isActive: false,
          bannedAt: new Date(),
          bannedReason: reason,
          suspendedAt: null,
          suspendedReason: null,
          suspendedUntil: null
        }
      });
      await this.prisma.profile.updateMany({
        where: { userId },
        data: {
          profileStatus: ProfileModerationStatus.banned,
          profileSuspendedAt: new Date(),
          profileSuspendedReason: reason
        }
      });
      await this.logAction({
        adminUserId: adminId,
        targetUserId: userId,
        targetProfileType: AdminAuditTargetType.account,
        action: AdminAuditAction.ban,
        reason
      });
      await this.notifyUser({
        adminUserId: adminId,
        userId,
        title: "Compte désactivé",
        body: reason.slice(0, 500),
        type: AdminMessageType.warning,
        notify: dto.notifyUser
      });
      return { ok: true };
    }

    const pt = scopeToProfileType(dto.scope);
    if (!pt) {
      throw new BadRequestException("Scope profil invalide");
    }
    const profile = await this.prisma.profile.findUnique({
      where: { userId_type: { userId, type: pt } }
    });
    if (!profile) {
      throw new NotFoundException("Profil introuvable");
    }
    await this.prisma.profile.update({
      where: { id: profile.id },
      data: {
        profileStatus: ProfileModerationStatus.banned,
        profileSuspendedAt: new Date(),
        profileSuspendedReason: reason
      }
    });
    if (pt === ProfileType.veterinarian) {
      await this.prisma.vetProfile.updateMany({
        where: { userId },
        data: { availability: false }
      });
    }
    await this.logAction({
      adminUserId: adminId,
      targetUserId: userId,
      targetProfileType: profileTypeToAuditTarget(pt),
      targetProfileId: profile.id,
      action: AdminAuditAction.ban,
      reason
    });
    await this.notifyUser({
      adminUserId: adminId,
      userId,
      title: "Profil désactivé",
      body: reason.slice(0, 500),
      type: AdminMessageType.warning,
      notify: dto.notifyUser
    });
    return { ok: true };
  }

  async unbanUser(adminId: string, userId: string, dto: UnbanUserDto) {
    await this.getUserOrThrow(userId);

    if (dto.scope === ModerationScopeDto.account) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          accountStatus: AccountStatus.active,
          isActive: true,
          bannedAt: null,
          bannedReason: null
        }
      });
      await this.prisma.profile.updateMany({
        where: { userId, profileStatus: ProfileModerationStatus.banned },
        data: {
          profileStatus: ProfileModerationStatus.active,
          profileSuspendedAt: null,
          profileSuspendedReason: null
        }
      });
      await this.logAction({
        adminUserId: adminId,
        targetUserId: userId,
        targetProfileType: AdminAuditTargetType.account,
        action: AdminAuditAction.unban,
        reason: dto.note ?? null
      });
      await this.notifyUser({
        adminUserId: adminId,
        userId,
        title: "Compte réactivé",
        body: dto.note?.trim()
          ? `Votre compte a été réactivé. ${dto.note}`
          : "Votre compte a été réactivé.",
        type: AdminMessageType.info,
        notify: dto.notifyUser
      });
      return { ok: true };
    }

    const pt = scopeToProfileType(dto.scope);
    if (!pt) {
      throw new BadRequestException("Scope profil invalide");
    }
    const profile = await this.prisma.profile.findUnique({
      where: { userId_type: { userId, type: pt } }
    });
    if (!profile) {
      throw new NotFoundException("Profil introuvable");
    }
    await this.prisma.profile.update({
      where: { id: profile.id },
      data: {
        profileStatus: ProfileModerationStatus.active,
        profileSuspendedAt: null,
        profileSuspendedReason: null
      }
    });
    await this.logAction({
      adminUserId: adminId,
      targetUserId: userId,
      targetProfileType: profileTypeToAuditTarget(pt),
      targetProfileId: profile.id,
      action: AdminAuditAction.unban,
      reason: dto.note ?? null
    });
    return { ok: true };
  }

  async deleteVetProfile(adminId: string, userId: string, dto: DeleteProfileAdminDto) {
    await this.getUserOrThrow(userId);
    const profile = await this.prisma.profile.findUnique({
      where: { userId_type: { userId, type: ProfileType.veterinarian } }
    });
    if (!profile) {
      throw new NotFoundException("Profil vétérinaire introuvable");
    }
    await this.prisma.vetProfile.deleteMany({ where: { userId } });
    await this.prisma.profile.delete({ where: { id: profile.id } });
    await this.logAction({
      adminUserId: adminId,
      targetUserId: userId,
      targetProfileType: AdminAuditTargetType.vet_profile,
      targetProfileId: profile.id,
      action: AdminAuditAction.delete_profile,
      reason: dto.reason
    });
    if (dto.notifyUser !== false) {
      await this.notifyUser({
        adminUserId: adminId,
        userId,
        title: "Profil vétérinaire supprimé",
        body: dto.reason.slice(0, 500),
        type: AdminMessageType.warning,
        notify: true
      });
    }
    return { ok: true };
  }

  async deleteProducerProfile(adminId: string, userId: string, dto: DeleteProfileAdminDto) {
    await this.getUserOrThrow(userId);
    const profile = await this.prisma.profile.findUnique({
      where: { userId_type: { userId, type: ProfileType.producer } }
    });
    if (!profile) {
      throw new NotFoundException("Profil producteur introuvable");
    }
    await this.prisma.profile.delete({ where: { id: profile.id } });
    await this.logAction({
      adminUserId: adminId,
      targetUserId: userId,
      targetProfileType: AdminAuditTargetType.farm_profile,
      targetProfileId: profile.id,
      action: AdminAuditAction.delete_profile,
      reason: dto.reason
    });
    if (dto.notifyUser !== false) {
      await this.notifyUser({
        adminUserId: adminId,
        userId,
        title: "Profil producteur supprimé",
        body: dto.reason.slice(0, 500),
        type: AdminMessageType.warning,
        notify: true
      });
    }
    return { ok: true };
  }

  async deleteAccount(adminId: string, userId: string, dto: DeleteAccountAdminDto) {
    const user = await this.getUserOrThrow(userId);
    if (dto.notifyUser !== false) {
      await this.push.sendToUser(
        userId,
        "Suppression de compte",
        dto.reason.slice(0, 180),
        { type: "admin_moderation" }
      );
    }
    await this.logAction({
      adminUserId: adminId,
      targetUserId: userId,
      targetProfileType: AdminAuditTargetType.account,
      action: AdminAuditAction.delete_account,
      reason: dto.reason
    });
    await this.accountDeletion.deleteAccount(user);
    return { ok: true };
  }

  async warnUser(adminId: string, userId: string, dto: WarnUserDto) {
    await this.getUserOrThrow(userId);
    const body = `${dto.motive}\n\n${dto.message}\n\n(${dto.warningLevel})`;
    const row = await this.prisma.adminMessage.create({
      data: {
        adminUserId: adminId,
        recipientUserId: userId,
        subject: `Avertissement — ${dto.motive}`,
        message: body,
        type: AdminMessageType.warning
      }
    });
    await this.logAction({
      adminUserId: adminId,
      targetUserId: userId,
      targetProfileType: AdminAuditTargetType.account,
      action: AdminAuditAction.warn,
      reason: dto.motive,
      metadata: { warningLevel: dto.warningLevel, messageId: row.id }
    });
    if (dto.notifyUser !== false) {
      await this.push.sendToUser(
        userId,
        "Avertissement",
        dto.message.slice(0, 180),
        { type: "admin_message", messageId: row.id }
      );
    }
    return { ok: true, messageId: row.id };
  }

  async sendMessage(adminId: string, userId: string, dto: SendAdminMessageDto) {
    await this.getUserOrThrow(userId);
    const row = await this.prisma.adminMessage.create({
      data: {
        adminUserId: adminId,
        recipientUserId: userId,
        subject: dto.subject,
        message: dto.message,
        type: dto.type
      }
    });
    await this.logAction({
      adminUserId: adminId,
      targetUserId: userId,
      targetProfileType: AdminAuditTargetType.account,
      action: AdminAuditAction.message,
      reason: dto.subject,
      metadata: { messageId: row.id, type: dto.type }
    });
    if (dto.sendPush !== false) {
      await this.push.sendToUser(userId, dto.subject, dto.message.slice(0, 180), {
        type: "admin_message",
        messageId: row.id
      });
    }
    return { ok: true, messageId: row.id };
  }

  async sendBulkMessage(adminId: string, dto: BulkAdminMessageDto) {
    const results: Array<{ userId: string; messageId: string }> = [];
    for (const userId of dto.userIds) {
      const r = await this.sendMessage(adminId, userId, dto);
      results.push({ userId, messageId: r.messageId });
    }
    return { ok: true, count: results.length, results };
  }

  async listAuditLogs(query: {
    userId?: string;
    adminId?: string;
    action?: AdminAuditAction;
    skip?: number;
    take?: number;
  }) {
    const take = Math.min(query.take ?? 50, 100);
    const skip = query.skip ?? 0;
    const where: Prisma.AdminAuditLogWhereInput = {};
    if (query.userId) {
      where.targetUserId = query.userId;
    }
    if (query.adminId) {
      where.adminUserId = query.adminId;
    }
    if (query.action) {
      where.action = query.action;
    }
    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          admin: { select: { id: true, fullName: true, email: true } },
          target: { select: { id: true, fullName: true, email: true } }
        }
      }),
      this.prisma.adminAuditLog.count({ where })
    ]);
    return {
      total,
      items: items.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        action: r.action,
        targetProfileType: r.targetProfileType,
        targetProfileId: r.targetProfileId,
        reason: r.reason,
        metadata: r.metadata,
        admin: r.admin,
        target: r.target
      }))
    };
  }

  async listMessagesForUser(userId: string, skip = 0, take = 50) {
    const t = Math.min(take, 100);
    const [items, total] = await Promise.all([
      this.prisma.adminMessage.findMany({
        where: { recipientUserId: userId },
        skip,
        take: t,
        orderBy: { sentAt: "desc" },
        include: {
          admin: { select: { id: true, fullName: true, email: true } }
        }
      }),
      this.prisma.adminMessage.count({ where: { recipientUserId: userId } })
    ]);
    return {
      total,
      items: items.map((m) => ({
        id: m.id,
        subject: m.subject,
        message: m.message,
        type: m.type,
        isRead: m.isRead,
        sentAt: m.sentAt.toISOString(),
        readAt: m.readAt?.toISOString() ?? null,
        admin: m.admin
      }))
    };
  }

  async listMessagesForRecipient(recipient: User, skip = 0, take = 30) {
    return this.listMessagesForUser(recipient.id, skip, take);
  }

  async markMessageRead(recipientId: string, messageId: string) {
    const row = await this.prisma.adminMessage.findFirst({
      where: { id: messageId, recipientUserId: recipientId }
    });
    if (!row) {
      throw new NotFoundException("Message introuvable");
    }
    if (!row.isRead) {
      await this.prisma.adminMessage.update({
        where: { id: messageId },
        data: { isRead: true, readAt: new Date() }
      });
    }
    return { ok: true };
  }

  async countUnreadMessages(recipientId: string) {
    const count = await this.prisma.adminMessage.count({
      where: { recipientUserId: recipientId, isRead: false }
    });
    return { count };
  }
}
