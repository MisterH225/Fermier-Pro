import { Injectable } from "@nestjs/common";
import {
  ListingStatus,
  VetAppointmentStatus,
  VetVerificationStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  aggregateHealthVerifiedByFarm,
  HEALTH_VERIFIED_WINDOW_MS,
  type HealthVerifiedAppointmentCandidate
} from "../marketplace/health-verified.util";
import { APP_EVENT } from "./app-events.constants";
import { AppEventsService } from "./app-events.service";
import { buildListingHealthBadgeAggregate } from "./listing-health-badge-aggregate.util";

/**
 * Agrégat quotidien du ratio d'annonces badgées Santé.
 * Appelé depuis le cron marketplace — idempotent via dedupeKey.
 */
@Injectable()
export class ListingHealthBadgeAggregateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: AppEventsService
  ) {}

  async recordDailyRatio(
    now: Date = new Date()
  ): Promise<{ created: boolean; total: number; badged: number }> {
    const listings = await this.prisma.marketplaceListing.findMany({
      where: {
        status: ListingStatus.published,
        archived: false,
        farmId: { not: null }
      },
      select: { farmId: true }
    });
    const total = listings.length;
    const farmIds = [
      ...new Set(
        listings
          .map((l) => l.farmId)
          .filter((id): id is string => typeof id === "string")
      )
    ];

    let badged = 0;
    if (farmIds.length > 0) {
      const since30 = new Date(now.getTime() - HEALTH_VERIFIED_WINDOW_MS);
      const rows = await this.prisma.vetAppointment.findMany({
        where: {
          farmId: { in: farmIds },
          status: {
            in: [
              VetAppointmentStatus.APPOINTMENT_COMPLETED,
              VetAppointmentStatus.APPOINTMENT_RATED
            ]
          },
          completedAt: { gte: since30 },
          vetProfile: {
            verificationStatus: VetVerificationStatus.verified
          }
        },
        select: {
          farmId: true,
          completedAt: true,
          vetProfileId: true,
          vetProfile: {
            select: { fullName: true, verificationStatus: true }
          }
        }
      });
      const candidates: HealthVerifiedAppointmentCandidate[] = rows
        .filter((r) => r.completedAt != null)
        .map((r) => ({
          farmId: r.farmId,
          completedAt: r.completedAt as Date,
          vetProfileId: r.vetProfileId,
          vetName: r.vetProfile.fullName,
          vetVerified:
            r.vetProfile.verificationStatus === VetVerificationStatus.verified
        }));
      const verifiedFarms = aggregateHealthVerifiedByFarm(candidates, now);
      for (const l of listings) {
        if (l.farmId && verifiedFarms.has(l.farmId)) {
          badged += 1;
        }
      }
    }

    const { props, dedupeKey } = buildListingHealthBadgeAggregate({
      total,
      badged,
      now
    });
    const result = await this.events.track(
      APP_EVENT.listingHealthBadge,
      props,
      { dedupeKey }
    );
    return { created: result.created, total, badged };
  }
}
