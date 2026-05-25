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
import { PrismaService } from "../prisma/prisma.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { SupabaseAdminService } from "./supabase-admin.service";

function storagePathFromPublicUrl(
  url: string | null | undefined,
  bucket: string
): string | null {
  if (!url?.trim()) {
    return null;
  }
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) {
    return null;
  }
  return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
}

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly push: PushNotificationsService,
    private readonly supabaseAdmin: SupabaseAdminService
  ) {}

  async deleteAccount(user: User): Promise<void> {
    const ownedFarms = await this.prisma.farm.findMany({
      where: { ownerId: user.id },
      select: { id: true, name: true }
    });
    const ownedFarmIds = ownedFarms.map((f) => f.id);

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

    try {
      await this.supabaseAdmin.removeStorageObjects("avatars", avatarPaths);
      await this.supabaseAdmin.removeStorageObjects(
        "finance-proofs",
        financePaths
      );
    } catch (err) {
      this.logger.warn(
        `Storage cleanup partial: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const supabaseUserId = user.supabaseUserId;

    try {
      await this.prisma.$transaction(
        async (tx) => {
          for (const farmId of ownedFarmIds) {
            await this.purgeOwnedFarmForDeletion(tx, farmId);
            await tx.farm.delete({ where: { id: farmId } });
          }

          await this.purgeUserScopedRows(tx, user.id);

          await tx.user.delete({ where: { id: user.id } });
        },
        { maxWait: 15_000, timeout: 120_000 }
      );
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

  /**
   * Supprime les lignes qui bloquent le CASCADE Prisma sur `Farm`
   * (ex. `FarmBudgetLine` → `FinanceCategory` en Restrict).
   */
  private async purgeOwnedFarmForDeletion(
    tx: Prisma.TransactionClient,
    farmId: string
  ): Promise<void> {
    await tx.farmBudgetLine.deleteMany({
      where: { budget: { farmId } }
    });
    await tx.farmBudgetSuggestion.deleteMany({ where: { farmId } });
    await tx.farmBudget.deleteMany({ where: { farmId } });

    await tx.litter.deleteMany({ where: { farmId } });
    await tx.gestationVaccine.deleteMany({
      where: { gestation: { farmId } }
    });
    await tx.gestationChecklistItem.deleteMany({
      where: { gestation: { farmId } }
    });
    await tx.gestation.deleteMany({ where: { farmId } });

    await tx.livestockExit.deleteMany({
      where: { OR: [{ farmId }, { toFarmId: farmId }] }
    });

    await tx.marketplaceOffer.deleteMany({
      where: { listing: { farmId } }
    });
    await tx.marketplaceListing.deleteMany({ where: { farmId } });

    await tx.farmMembership.deleteMany({ where: { farmId } });
    await tx.farmInvitation.deleteMany({ where: { farmId } });
    await tx.farmMarketRating.deleteMany({ where: { farmId } });
    await tx.chatMessage.deleteMany({ where: { room: { farmId } } });
    await tx.chatRoomMember.deleteMany({ where: { room: { farmId } } });
    await tx.chatRoom.deleteMany({ where: { farmId } });
  }

  /** Données liées à l'utilisateur hors fermes déjà supprimées. */
  private async purgeUserScopedRows(
    tx: Prisma.TransactionClient,
    userId: string
  ): Promise<void> {
    await tx.marketplaceOffer.deleteMany({ where: { buyerUserId: userId } });
    await tx.marketplaceListing.deleteMany({ where: { sellerUserId: userId } });
    await tx.chatMessage.deleteMany({ where: { senderUserId: userId } });
    await tx.farmMarketRating.deleteMany({ where: { ratedByUserId: userId } });
    await tx.auditLog.deleteMany({ where: { actorUserId: userId } });
    await tx.farmMembership.deleteMany({ where: { userId } });
    await tx.farmInvitation.deleteMany({ where: { createdById: userId } });
    await tx.taskNotification.deleteMany({ where: { userId } });
    await tx.farmTask.deleteMany({ where: { createdByUserId: userId } });
    await tx.farmExpense.deleteMany({ where: { createdByUserId: userId } });
    await tx.farmRevenue.deleteMany({ where: { createdByUserId: userId } });
    await tx.feedStockMovement.deleteMany({ where: { createdByUserId: userId } });
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
    await tx.vetConsultationAttachment.deleteMany({
      where: { uploadedByUserId: userId }
    });
    await tx.vetConsultation.deleteMany({ where: { openedByUserId: userId } });
  }
}
