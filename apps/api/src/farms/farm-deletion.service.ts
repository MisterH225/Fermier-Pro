import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SupabaseAdminService } from "../auth/supabase-admin.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { FarmMarketplaceLifecycleService } from "../marketplace/farm-marketplace-lifecycle.service";
import { REPORTS_STORAGE_BUCKET } from "../reports/reports.constants";
import { FarmDataPurgeService } from "./farm-data-purge.service";

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

function reportPdfStoragePath(
  pdfUrl: string | null | undefined
): string | null {
  if (!pdfUrl?.trim()) {
    return null;
  }
  const trimmed = pdfUrl.trim();
  const fromReports = storagePathFromPublicUrl(trimmed, REPORTS_STORAGE_BUCKET);
  if (fromReports) {
    return fromReports;
  }
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return trimmed.replace(/^\/+/, "");
  }
  return storagePathFromPublicUrl(trimmed, "finance-proofs");
}

@Injectable()
export class FarmDeletionService {
  private readonly logger = new Logger(FarmDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly push: PushNotificationsService,
    private readonly marketplaceLifecycle: FarmMarketplaceLifecycleService,
    private readonly farmDataPurge: FarmDataPurgeService
  ) {}

  async deleteFarm(farmId: string, actorUserId: string): Promise<void> {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: { id: true, name: true, ownerId: true }
    });
    if (!farm) {
      throw new BadRequestException("Projet introuvable");
    }

    const collaborators = await this.prisma.farmMembership.findMany({
      where: {
        farmId,
        userId: { not: actorUserId }
      },
      select: { userId: true }
    });

    const storagePaths: string[] = [];
    const reportPdfPaths: string[] = [];

    const [expenses, revenues, reports, listings, animals, healthRecords, vetProfiles] =
      await Promise.all([
        this.prisma.farmExpense.findMany({
          where: { farmId },
          select: { attachmentUrl: true }
        }),
        this.prisma.farmRevenue.findMany({
          where: { farmId },
          select: { attachmentUrl: true }
        }),
        this.prisma.farmReport.findMany({
          where: { farmId },
          select: { pdfUrl: true }
        }),
        this.prisma.marketplaceListing.findMany({
          where: { farmId },
          select: { photoUrls: true }
        }),
        this.prisma.animal.findMany({
          where: { farmId },
          select: { photoUrl: true }
        }),
        this.prisma.farmHealthRecord.findMany({
          where: { farmId },
          select: { attachmentUrl: true }
        }),
        this.prisma.vetConsultationAttachment.findMany({
          where: { consultation: { farmId } },
          select: { url: true }
        })
      ]);

    for (const row of expenses) {
      const p = storagePathFromPublicUrl(row.attachmentUrl, "finance-proofs");
      if (p) storagePaths.push(p);
    }
    for (const row of revenues) {
      const p = storagePathFromPublicUrl(row.attachmentUrl, "finance-proofs");
      if (p) storagePaths.push(p);
    }
    for (const row of reports) {
      const p = reportPdfStoragePath(row.pdfUrl);
      if (p) {
        reportPdfPaths.push(p);
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
        if (p) storagePaths.push(p);
      }
    }
    for (const animal of animals) {
      const p = storagePathFromPublicUrl(animal.photoUrl, "avatars");
      if (p) storagePaths.push(p);
    }
    for (const record of healthRecords) {
      const p = storagePathFromPublicUrl(record.attachmentUrl, "finance-proofs");
      if (p) storagePaths.push(p);
    }
    for (const att of vetProfiles) {
      const p = storagePathFromPublicUrl(att.url, "finance-proofs");
      if (p) storagePaths.push(p);
    }

    for (const collab of collaborators) {
      void this.push.sendToUser(
        collab.userId,
        "Projet supprimé",
        `Le projet « ${farm.name} » a été supprimé par son propriétaire.`
      );
    }

    try {
      await this.supabaseAdmin.removeStorageObjects("finance-proofs", storagePaths);
      await this.supabaseAdmin.removeStorageObjects("avatars", storagePaths);
      if (reportPdfPaths.length > 0) {
        await this.supabaseAdmin.removeStorageObjects(
          REPORTS_STORAGE_BUCKET,
          reportPdfPaths
        );
      }
    } catch (err) {
      this.logger.warn(
        `Storage cleanup partial: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    try {
      let deleteNotices: Awaited<
        ReturnType<FarmMarketplaceLifecycleService["applyFarmDeleted"]>
      >["notices"] = [];
      await this.prisma.$transaction(
        async (tx) => {
          deleteNotices = await this.farmDataPurge.purgeFarmWithinTransaction(
            tx,
            farmId
          );
          await tx.farm.delete({ where: { id: farmId } });
        },
        { maxWait: 15_000, timeout: 120_000 }
      );
      this.marketplaceLifecycle.dispatchBuyerNotices(deleteNotices);
    } catch (err) {
      this.logger.error(
        `Farm deletion rollback for farm ${farmId}`,
        err instanceof Error ? err.stack : String(err)
      );
      throw new InternalServerErrorException(
        "La suppression du projet a échoué. Aucune donnée n'a été modifiée."
      );
    }
  }
}
