import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { AuditService } from "../common/audit.service";
import { AUDIT_ACTION } from "../common/audit.constants";
import { storagePathFromPublicUrl } from "../common/storage.util";
import { FarmDataPurgeService } from "../farms/farm-data-purge.service";
import { ACTIVE_ESCROW_STATUSES } from "../marketplace/escrow/transaction.utils";
import { PrismaService } from "../prisma/prisma.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { SupabaseAdminService } from "./supabase-admin.service";

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly push: PushNotificationsService,
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly farmDataPurge: FarmDataPurgeService
  ) {}

  async deleteAccount(user: User): Promise<void> {
    const activeEscrow = await this.prisma.marketplaceTransaction.count({
      where: {
        OR: [{ buyerUserId: user.id }, { sellerUserId: user.id }],
        status: { in: ACTIVE_ESCROW_STATUSES }
      }
    });
    if (activeEscrow > 0) {
      throw new BadRequestException(
        "Compte non supprimable : transactions marketplace en cours. Attendez leur clôture."
      );
    }

    const ownedFarms = await this.prisma.farm.findMany({
      where: { ownerId: user.id },
      select: { id: true, name: true }
    });
    const ownedFarmIds = ownedFarms.map((f) => f.id);

    if (ownedFarmIds.length > 0) {
      const farmEscrow = await this.prisma.marketplaceTransaction.count({
        where: {
          listing: { farmId: { in: ownedFarmIds } },
          status: { in: ACTIVE_ESCROW_STATUSES }
        }
      });
      if (farmEscrow > 0) {
        throw new BadRequestException(
          "Compte non supprimable : transaction escrow active sur un de vos projets. Attendez sa clôture."
        );
      }
    }

    const collaborators =
      ownedFarmIds.length > 0
        ? await this.prisma.farmMembership.findMany({
            where: {
              farmId: { in: ownedFarmIds },
              userId: { not: user.id }
            },
            select: {
              userId: true,
              farm: { select: { name: true } }
            }
          })
        : [];

    await this.audit.record({
      actorUserId: user.id,
      farmId: ownedFarmIds[0] ?? null,
      action: AUDIT_ACTION.accountDeleted,
      resourceType: "user",
      resourceId: user.id,
      metadata: {
        ownedFarmCount: ownedFarmIds.length,
        email: user.email ?? null
      } as Prisma.InputJsonValue
    });

    const avatarPaths: string[] = [];
    const avatarPath = storagePathFromPublicUrl(user.avatarUrl, "avatars");
    if (avatarPath) {
      avatarPaths.push(avatarPath);
    }
    const profiles = await this.prisma.profile.findMany({
      where: { userId: user.id },
      select: { avatarUrl: true, type: true }
    });
    for (const profile of profiles) {
      const p = storagePathFromPublicUrl(profile.avatarUrl, "avatars");
      if (p) {
        avatarPaths.push(p);
      }
    }
    if (user.supabaseUserId) {
      const profileTypes = ["producer", "technician", "veterinarian", "buyer"];
      for (const profileType of profileTypes) {
        avatarPaths.push(`${user.supabaseUserId}/${profileType}/avatar.jpg`);
        avatarPaths.push(`${user.supabaseUserId}/${profileType}/avatar.png`);
        avatarPaths.push(`${user.supabaseUserId}/${profileType}/avatar.webp`);
      }
      avatarPaths.push(`${user.supabaseUserId}/avatar.jpg`);
      avatarPaths.push(`${user.supabaseUserId}/avatar.png`);
      avatarPaths.push(`${user.supabaseUserId}/avatar.webp`);
    }

    const financePaths: string[] = [];
    if (ownedFarmIds.length > 0) {
      const [expenses, revenues, reports, listings] = await Promise.all([
        this.prisma.farmExpense.findMany({
          where: { farmId: { in: ownedFarmIds } },
          select: { attachmentUrl: true }
        }),
        this.prisma.farmRevenue.findMany({
          where: { farmId: { in: ownedFarmIds } },
          select: { attachmentUrl: true }
        }),
        this.prisma.farmReport.findMany({
          where: { farmId: { in: ownedFarmIds } },
          select: { pdfUrl: true }
        }),
        this.prisma.marketplaceListing.findMany({
          where: { sellerUserId: user.id },
          select: { photoUrls: true }
        })
      ]);
      for (const row of expenses) {
        const p = storagePathFromPublicUrl(row.attachmentUrl, "finance-proofs");
        if (p) {
          financePaths.push(p);
        }
      }
      for (const row of revenues) {
        const p = storagePathFromPublicUrl(row.attachmentUrl, "finance-proofs");
        if (p) {
          financePaths.push(p);
        }
      }
      for (const row of reports) {
        const p = storagePathFromPublicUrl(row.pdfUrl, "finance-proofs");
        if (p) {
          financePaths.push(p);
        }
      }
      for (const listing of listings) {
        const urls = Array.isArray(listing.photoUrls)
          ? (listing.photoUrls as string[])
          : [];
        for (const url of urls) {
          const p =
            storagePathFromPublicUrl(url, "finance-proofs") ??
            storagePathFromPublicUrl(url, "avatars");
          if (p) {
            financePaths.push(p);
          }
        }
      }
    }

    for (const collab of collaborators) {
      const farmName = collab.farm.name;
      void this.push.sendToUser(
        collab.userId,
        "Accès révoqué",
        `Votre accès à ${farmName} a été révoqué — le propriétaire a supprimé son compte.`
      );
    }

    const supabaseUserId = user.supabaseUserId;

    try {
      const buyerNotices: Awaited<
        ReturnType<FarmDataPurgeService["purgeFarmWithinTransaction"]>
      > = [];
      await this.prisma.$transaction(
        async (tx) => {
          for (const farmId of ownedFarmIds) {
            const notices = await this.farmDataPurge.purgeFarmWithinTransaction(
              tx,
              farmId
            );
            buyerNotices.push(...notices);
            await tx.farm.delete({ where: { id: farmId } });
          }

          await this.farmDataPurge.purgeUserMarketplaceData(tx, user.id);
          await this.purgeUserScopedRows(tx, user.id);

          await tx.user.update({
            where: { id: user.id },
            data: { activeFarmId: null }
          });
          await tx.user.delete({ where: { id: user.id } });
        },
        { maxWait: 15_000, timeout: 120_000 }
      );
      this.farmDataPurge.dispatchBuyerNotices(buyerNotices);
    } catch (err) {
      this.logger.error(
        `Account deletion rollback for user ${user.id}`,
        err instanceof Error ? err.stack : String(err)
      );
      throw new InternalServerErrorException(
        "La suppression du compte a échoué. Aucune donnée n'a été modifiée."
      );
    }

    try {
      await this.supabaseAdmin.removeStorageObjects("avatars", avatarPaths);
      await this.supabaseAdmin.removeStorageObjects(
        "finance-proofs",
        financePaths
      );
    } catch (err) {
      this.logger.warn(
        `Storage cleanup partiel post-suppression compte ${user.id}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    try {
      await this.supabaseAdmin.deleteAuthUser(supabaseUserId);
    } catch (err) {
      this.logger.error(
        `App user deleted but Supabase auth delete failed for ${supabaseUserId}`,
        err
      );
      throw new BadRequestException(
        "Compte applicatif supprimé ; contactez le support si vous ne pouvez plus vous connecter."
      );
    }
  }

  /** Données liées à l'utilisateur hors fermes déjà supprimées. */
  private async purgeUserScopedRows(
    tx: Prisma.TransactionClient,
    userId: string
  ): Promise<void> {
    const vetAppointments = await tx.vetAppointment.findMany({
      where: { OR: [{ producerUserId: userId }, { vetUserId: userId }] },
      select: { id: true }
    });
    const vetAppointmentIds = vetAppointments.map((a) => a.id);
    if (vetAppointmentIds.length > 0) {
      await tx.platformRevenue.deleteMany({
        where: { vetAppointmentId: { in: vetAppointmentIds } }
      });
      await tx.vetAppointmentFundMovement.deleteMany({
        where: { appointmentId: { in: vetAppointmentIds } }
      });
      await tx.vetAppointmentRating.deleteMany({
        where: { appointmentId: { in: vetAppointmentIds } }
      });
      await tx.vetAppointment.deleteMany({
        where: { id: { in: vetAppointmentIds } }
      });
    }

    await tx.vetConsultation.updateMany({
      where: { primaryVetUserId: userId },
      data: { primaryVetUserId: null }
    });
    await tx.vetConsultationAttachment.deleteMany({
      where: { uploadedByUserId: userId }
    });
    await tx.vetConsultation.deleteMany({ where: { openedByUserId: userId } });

    await tx.chatMessage.deleteMany({ where: { senderUserId: userId } });
    await tx.farmMarketRating.deleteMany({ where: { ratedByUserId: userId } });
    await tx.auditLog.deleteMany({ where: { actorUserId: userId } });
    await tx.adminAuditLog.deleteMany({ where: { adminUserId: userId } });
    await tx.adminMessage.deleteMany({ where: { adminUserId: userId } });
    await tx.farmMembership.deleteMany({ where: { userId } });
    await tx.farmInvitation.deleteMany({ where: { createdById: userId } });
    await tx.taskNotification.deleteMany({ where: { userId } });
    await tx.farmTask.deleteMany({ where: { createdByUserId: userId } });
    await tx.farmExpense.deleteMany({ where: { createdByUserId: userId } });
    await tx.farmRevenue.deleteMany({ where: { createdByUserId: userId } });
    await tx.feedStockMovement.deleteMany({ where: { createdByUserId: userId } });
    await tx.feedReconciliationRejection.deleteMany({
      where: { rejectedByUserId: userId }
    });
    await tx.livestockStatusLog.deleteMany({
      where: { recordedByUserId: userId }
    });
    await tx.livestockExit.deleteMany({ where: { recordedByUserId: userId } });
    await tx.penPlacement.deleteMany({ where: { createdByUserId: userId } });
    await tx.penLog.deleteMany({ where: { recordedByUserId: userId } });
    await tx.livestockBatchHealthEvent.deleteMany({
      where: { recordedByUserId: userId }
    });
    await tx.farmHealthRecord.deleteMany({
      where: { recordedByUserId: userId }
    });
  }
}
