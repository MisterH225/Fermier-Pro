import { Injectable } from "@nestjs/common";
import {
  ListingStatus,
  Prisma,
  VetAppointmentStatus,
  VetVerificationStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UserNotificationsService } from "../user-notifications/user-notifications.service";
import {
  aggregateLatestVerifiedVisitByFarm,
  HEALTH_BADGE_EXPIRY_REMINDER_DAYS,
  HEALTH_VERIFIED_WINDOW_MS,
  healthBadgeExpiryWindowKey,
  isInHealthBadgeExpiryReminderWindow,
  MS_PER_DAY,
  type HealthVerifiedAppointmentCandidate
} from "./health-verified.util";

export type HealthBadgeExpiryReminderResult = {
  farmsNotified: number;
  producerNotifications: number;
  vetNotifications: number;
  skippedNoListing: number;
  skippedDuplicate: number;
};

/**
 * Relances quotidiennes J-5 avant expiration du badge « Santé vérifiée ».
 * Idempotence persistée via HealthBadgeExpiryReminder (farmId + windowKey).
 */
@Injectable()
export class HealthBadgeExpiryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: UserNotificationsService
  ) {}

  async sendExpiryReminders(
    now: Date = new Date()
  ): Promise<HealthBadgeExpiryReminderResult> {
    const result: HealthBadgeExpiryReminderResult = {
      farmsNotified: 0,
      producerNotifications: 0,
      vetNotifications: 0,
      skippedNoListing: 0,
      skippedDuplicate: 0
    };

    // J-5 ⇔ 24j < elapsed ≤ 25j (floor des jours restants === 5).
    const completedAtGte = new Date(
      now.getTime() - (30 - HEALTH_BADGE_EXPIRY_REMINDER_DAYS) * MS_PER_DAY
    );
    const completedAtLt = new Date(
      now.getTime() - (30 - HEALTH_BADGE_EXPIRY_REMINDER_DAYS - 1) * MS_PER_DAY
    );

    const rows = await this.prisma.vetAppointment.findMany({
      where: {
        status: {
          in: [
            VetAppointmentStatus.APPOINTMENT_COMPLETED,
            VetAppointmentStatus.APPOINTMENT_RATED
          ]
        },
        completedAt: { gte: completedAtGte, lt: completedAtLt },
        vetProfile: {
          verificationStatus: VetVerificationStatus.verified
        }
      },
      select: {
        farmId: true,
        completedAt: true,
        vetProfileId: true,
        vetUserId: true,
        producerUserId: true,
        farm: { select: { id: true, name: true, ownerId: true } },
        vetProfile: {
          select: { fullName: true, verificationStatus: true }
        }
      },
      orderBy: { completedAt: "desc" }
    });

    const candidates: HealthVerifiedAppointmentCandidate[] = rows
      .filter((r) => r.completedAt != null)
      .map((r) => ({
        farmId: r.farmId,
        completedAt: r.completedAt as Date,
        vetProfileId: r.vetProfileId,
        vetName: r.vetProfile.fullName,
        vetVerified:
          r.vetProfile.verificationStatus === VetVerificationStatus.verified,
        vetUserId: r.vetUserId
      }));

    const latestByFarm = aggregateLatestVerifiedVisitByFarm(candidates);

    // Enrichir avec owner / nom ferme / producerUserId depuis les rows.
    const farmMeta = new Map<
      string,
      { ownerId: string; farmName: string; producerUserId: string }
    >();
    for (const r of rows) {
      if (!farmMeta.has(r.farmId)) {
        farmMeta.set(r.farmId, {
          ownerId: r.farm.ownerId,
          farmName: r.farm.name,
          producerUserId: r.producerUserId
        });
      }
    }

    const farmIds = [...latestByFarm.keys()].filter((farmId) => {
      const info = latestByFarm.get(farmId)!;
      return isInHealthBadgeExpiryReminderWindow(info.completedAt, now);
    });

    if (farmIds.length === 0) {
      return result;
    }

    const activeListingFarms = await this.prisma.marketplaceListing.findMany({
      where: {
        farmId: { in: farmIds },
        status: ListingStatus.published,
        archived: false
      },
      select: { farmId: true },
      distinct: ["farmId"]
    });
    const farmsWithActiveListing = new Set(
      activeListingFarms
        .map((l) => l.farmId)
        .filter((id): id is string => typeof id === "string")
    );

    /** vetUserId → nombre d'élevages notifiés dans ce run. */
    const vetFarmCounts = new Map<string, number>();

    for (const farmId of farmIds) {
      if (!farmsWithActiveListing.has(farmId)) {
        result.skippedNoListing += 1;
        continue;
      }

      const info = latestByFarm.get(farmId)!;
      const meta = farmMeta.get(farmId);
      if (!meta) continue;

      const windowKey = healthBadgeExpiryWindowKey(info.completedAt);
      const claimed = await this.claimReminder(farmId, windowKey);
      if (!claimed) {
        result.skippedDuplicate += 1;
        continue;
      }

      const producerId = meta.ownerId || meta.producerUserId;
      await this.notifications.notify(
        producerId,
        "Badge Santé vérifiée",
        "Votre badge Santé vérifiée expire dans 5 jours — reprenez rendez-vous pour le conserver",
        {
          type: "health_badge_expiry_producer",
          farmId,
          farmName: meta.farmName
        }
      );
      result.producerNotifications += 1;
      result.farmsNotified += 1;

      if (info.vetUserId) {
        vetFarmCounts.set(
          info.vetUserId,
          (vetFarmCounts.get(info.vetUserId) ?? 0) + 1
        );
      }
    }

    for (const [vetUserId, count] of vetFarmCounts) {
      const body =
        count === 1
          ? "1 élevage que vous suivez arrive à expiration"
          : `${count} élevages que vous suivez arrivent à expiration`;
      await this.notifications.notify(
        vetUserId,
        "Badge Santé — expirations",
        body,
        {
          type: "health_badge_expiry_vet",
          count: String(count)
        }
      );
      result.vetNotifications += 1;
    }

    return result;
  }

  /**
   * Tente d'enregistrer la déduplication. `false` si déjà envoyé pour cette fenêtre.
   */
  private async claimReminder(
    farmId: string,
    windowKey: string
  ): Promise<boolean> {
    try {
      await this.prisma.healthBadgeExpiryReminder.create({
        data: { farmId, windowKey }
      });
      return true;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return false;
      }
      throw e;
    }
  }
}

/** Bornes SQL utiles pour tests / debug (fenêtre J-5). */
export function healthBadgeExpiryReminderCompletedAtBounds(now: Date): {
  gte: Date;
  lt: Date;
} {
  return {
    gte: new Date(
      now.getTime() - (30 - HEALTH_BADGE_EXPIRY_REMINDER_DAYS) * MS_PER_DAY
    ),
    lt: new Date(
      now.getTime() -
        (30 - HEALTH_BADGE_EXPIRY_REMINDER_DAYS - 1) * MS_PER_DAY
    )
  };
}

/** Exposé pour tests unitaires du filtre « annonce active ». */
export function farmQualifiesForHealthBadgeExpiryReminder(opts: {
  completedAt: Date;
  hasActiveListing: boolean;
  alreadyReminded: boolean;
  now?: Date;
}): boolean {
  const now = opts.now ?? new Date();
  if (opts.alreadyReminded) return false;
  if (!opts.hasActiveListing) return false;
  if (!isInHealthBadgeExpiryReminderWindow(opts.completedAt, now)) {
    return false;
  }
  // Garde-fou : le badge doit encore être dans la fenêtre de validité.
  const age = now.getTime() - opts.completedAt.getTime();
  return age >= 0 && age < HEALTH_VERIFIED_WINDOW_MS;
}
