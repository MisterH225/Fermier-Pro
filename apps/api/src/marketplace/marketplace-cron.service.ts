import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { OfferStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { ListingsService } from "./listings.service";

const OFFER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class MarketplaceCronService {
  private readonly logger = new Logger(MarketplaceCronService.name);

  constructor(
    private readonly listings: ListingsService,
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService
  ) {}

  /** Expire annonces et propositions sans reponse — chaque jour 4h UTC. */
  @Cron("0 4 * * *")
  async dailyMarketplaceMaintenance(): Promise<void> {
    try {
      const listingsExpired = await this.listings.expireStaleListings();
      const offersExpired = await this.expireStaleOffers();
      if (listingsExpired > 0 || offersExpired > 0) {
        this.logger.log(
          `Marketplace cron: ${listingsExpired} annonce(s), ${offersExpired} offre(s) expirees`
        );
      }
    } catch (e) {
      this.logger.error("marketplace cron failed", e);
    }
  }

  private async expireStaleOffers(): Promise<number> {
    const cutoff = new Date(Date.now() - OFFER_TTL_MS);
    const stale = await this.prisma.marketplaceOffer.findMany({
      where: {
        status: { in: [OfferStatus.pending, OfferStatus.countered] },
        createdAt: { lt: cutoff }
      },
      include: {
        buyer: { select: { id: true } },
        listing: { select: { title: true } }
      }
    });
    if (!stale.length) {
      return 0;
    }
    await this.prisma.marketplaceOffer.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { status: OfferStatus.rejected }
    });
    for (const row of stale) {
      void this.push.sendToUser(
        row.buyerUserId,
        "Proposition expirée",
        `Votre offre sur « ${row.listing.title} » a expiré sans réponse (7 jours).`,
        { type: "marketplace_offer_expired", offerId: row.id }
      );
    }
    return stale.length;
  }
}
