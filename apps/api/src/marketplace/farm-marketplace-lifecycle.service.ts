import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  FarmStatus,
  ListingStatus,
  OfferStatus,
  PigPriceSnapshotSource,
  type PigPriceIndexCategory
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { categoryForPriceIndexFromListing } from "./marketplace-listing-category.helper";
import { listingHeadcount } from "./marketplace-listing-category.helper";

const MARKETPLACE_MODULE_ID = "marketplace";

type BuyerNotice = {
  buyerUserId: string;
  title: string;
  body: string;
  listingId: string;
};

@Injectable()
export class FarmMarketplaceLifecycleService {
  private readonly log = new Logger(FarmMarketplaceLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService
  ) {}

  private listingCategoryLabel(
    category: string | null | undefined
  ): string {
    switch (category) {
      case "piglet":
        return "Porcelets";
      case "breeder":
        return "Reproducteurs";
      case "butcher":
        return "Charcutiers";
      case "reformed":
        return "Réformés";
      default:
        return "Porcs";
    }
  }

  private async registryPause(
    tx: Prisma.TransactionClient,
    listingId: string,
    originalStatus: string
  ) {
    await tx.archivedDataRegistry.create({
      data: {
        moduleId: MARKETPLACE_MODULE_ID,
        tableName: "MarketplaceListing",
        recordId: listingId,
        originalStatus
      }
    });
  }

  private async snapshotSoldListing(
    tx: Prisma.TransactionClient,
    listing: {
      id: string;
      farmId: string | null;
      category: string | null;
      totalPrice: Prisma.Decimal | null;
      totalWeightKg: Prisma.Decimal | null;
      pricePerKg: Prisma.Decimal | null;
      quantity: number | null;
      animalId: string | null;
      animalIds: Prisma.JsonValue;
      updatedAt: Date;
      animal: { productionCategory: string } | null;
    }
  ): Promise<void> {
    const totalPrice =
      listing.totalPrice != null ? Number(listing.totalPrice) : NaN;
    const totalWeight =
      listing.totalWeightKg != null ? Number(listing.totalWeightKg) : NaN;
    let pricePerKg: number | null = null;
    let weightKg: number | null = null;

    if (
      Number.isFinite(totalPrice) &&
      totalPrice > 0 &&
      Number.isFinite(totalWeight) &&
      totalWeight > 0
    ) {
      pricePerKg = totalPrice / totalWeight;
      weightKg = totalWeight;
    } else if (listing.pricePerKg != null) {
      const ppk = Number(listing.pricePerKg);
      if (Number.isFinite(ppk) && ppk > 0) {
        pricePerKg = ppk;
        const headcount = listingHeadcount(
          Array.isArray(listing.animalIds)
            ? (listing.animalIds as string[])
            : [],
          listing.animalId,
          listing.quantity
        );
        weightKg =
          totalWeight > 0
            ? totalWeight
            : headcount > 0
              ? headcount * 80
              : null;
      }
    }

    if (
      pricePerKg == null ||
      weightKg == null ||
      !Number.isFinite(pricePerKg) ||
      !Number.isFinite(weightKg) ||
      weightKg <= 0
    ) {
      return;
    }

    const indexCat = categoryForPriceIndexFromListing(
      listing.category as Parameters<typeof categoryForPriceIndexFromListing>[0],
      weightKg,
      listingHeadcount(
        Array.isArray(listing.animalIds)
          ? (listing.animalIds as string[])
          : [],
        listing.animalId,
        listing.quantity
      ),
      listing.animal?.productionCategory ?? null
    );
    if (!indexCat || indexCat === "global") {
      return;
    }

    await tx.pigPriceSnapshot.create({
      data: {
        category: indexCat as PigPriceIndexCategory,
        pricePerKg,
        weightKg,
        soldAt: listing.updatedAt,
        source: PigPriceSnapshotSource.listing,
        farmId: listing.farmId
      }
    });
  }

  /** Ferme archivée : masquer les annonces publiées, mettre les offres en attente. */
  async applyFarmArchived(
    tx: Prisma.TransactionClient,
    farmId: string,
    farmName: string
  ): Promise<BuyerNotice[]> {
    const notices: BuyerNotice[] = [];
    const published = await tx.marketplaceListing.findMany({
      where: { farmId, status: ListingStatus.published },
      select: { id: true, title: true, category: true }
    });
    if (published.length === 0) {
      return notices;
    }

    const listingIds = published.map((p) => p.id);
    await tx.marketplaceListing.updateMany({
      where: { id: { in: listingIds } },
      data: { status: ListingStatus.paused }
    });

    for (const row of published) {
      await this.registryPause(tx, row.id, ListingStatus.published);
    }

    const pendingOffers = await tx.marketplaceOffer.findMany({
      where: {
        listingId: { in: listingIds },
        status: { in: [OfferStatus.pending, OfferStatus.countered] }
      },
      select: {
        id: true,
        buyerUserId: true,
        listingId: true,
        listing: { select: { category: true, title: true } }
      }
    });

    if (pendingOffers.length > 0) {
      await tx.marketplaceOffer.updateMany({
        where: {
          id: { in: pendingOffers.map((o) => o.id) }
        },
        data: { status: OfferStatus.on_hold }
      });

      for (const offer of pendingOffers) {
        const cat = this.listingCategoryLabel(offer.listing.category);
        notices.push({
          buyerUserId: offer.buyerUserId,
          title: "Annonce temporairement indisponible",
          body: `L'annonce ${cat} de ${farmName} est temporairement indisponible.`,
          listingId: offer.listingId
        });
      }
    }

    return notices;
  }

  /** Ferme restaurée : réactiver les annonces en pause si non expirées. */
  async applyFarmRestored(
    tx: Prisma.TransactionClient,
    farmId: string,
    farmName: string
  ): Promise<BuyerNotice[]> {
    const notices: BuyerNotice[] = [];
    const now = new Date();
    const paused = await tx.marketplaceListing.findMany({
      where: { farmId, status: ListingStatus.paused },
      select: { id: true, expiresAt: true, category: true, title: true }
    });

    const reactivatedIds: string[] = [];
    for (const row of paused) {
      const expired = row.expiresAt != null && row.expiresAt <= now;
      await tx.marketplaceListing.update({
        where: { id: row.id },
        data: {
          status: expired ? ListingStatus.expired : ListingStatus.published
        }
      });
      if (!expired) {
        reactivatedIds.push(row.id);
      }
      await tx.archivedDataRegistry.updateMany({
        where: {
          moduleId: MARKETPLACE_MODULE_ID,
          tableName: "MarketplaceListing",
          recordId: row.id,
          restoredAt: null
        },
        data: { restoredAt: now }
      });
    }

    if (reactivatedIds.length === 0) {
      return notices;
    }

    const onHold = await tx.marketplaceOffer.findMany({
      where: {
        listingId: { in: reactivatedIds },
        status: OfferStatus.on_hold
      },
      select: {
        buyerUserId: true,
        listingId: true,
        listing: { select: { category: true } }
      }
    });

    if (onHold.length > 0) {
      await tx.marketplaceOffer.updateMany({
        where: {
          listingId: { in: reactivatedIds },
          status: OfferStatus.on_hold
        },
        data: { status: OfferStatus.pending }
      });

      for (const offer of onHold) {
        const cat = this.listingCategoryLabel(offer.listing.category);
        notices.push({
          buyerUserId: offer.buyerUserId,
          title: "Annonce de nouveau disponible",
          body: `L'annonce ${cat} de ${farmName} est de nouveau disponible. Votre proposition est toujours active.`,
          listingId: offer.listingId
        });
      }
    }

    return notices;
  }

  /**
   * Avant suppression ferme : anonymiser prix vendus, retirer annonces actives du marché.
   */
  async applyFarmDeleted(
    tx: Prisma.TransactionClient,
    farmId: string
  ): Promise<{ notices: BuyerNotice[]; listingIds: string[] }> {
    const notices: BuyerNotice[] = [];

    const allFarmListings = await tx.marketplaceListing.findMany({
      where: { farmId },
      select: { id: true }
    });
    const listingIds = allFarmListings.map((l) => l.id);

    const soldListings = await tx.marketplaceListing.findMany({
      where: { farmId, status: ListingStatus.sold },
      include: {
        animal: { select: { productionCategory: true } }
      }
    });
    for (const listing of soldListings) {
      await this.snapshotSoldListing(tx, listing);
    }

    const toWithdraw = await tx.marketplaceListing.findMany({
      where: {
        farmId,
        status: {
          in: [
            ListingStatus.published,
            ListingStatus.paused,
            ListingStatus.reserved,
            ListingStatus.draft
          ]
        }
      },
      select: { id: true, status: true, category: true, title: true }
    });

    const withdrawIds = toWithdraw.map((l) => l.id);
    if (withdrawIds.length > 0) {
      await tx.marketplaceListing.updateMany({
        where: { id: { in: withdrawIds } },
        data: { status: ListingStatus.cancelled, farmId: null }
      });
    }

    await tx.marketplaceListing.updateMany({
      where: { farmId, status: ListingStatus.sold },
      data: { farmId: null }
    });

    const pendingOffers = await tx.marketplaceOffer.findMany({
      where: {
        listingId: { in: withdrawIds },
        status: {
          in: [
            OfferStatus.pending,
            OfferStatus.countered,
            OfferStatus.on_hold
          ]
        }
      },
      select: {
        id: true,
        buyerUserId: true,
        listingId: true,
        listing: { select: { category: true } }
      }
    });

    if (pendingOffers.length > 0) {
      await tx.marketplaceOffer.updateMany({
        where: {
          id: { in: pendingOffers.map((o) => o.id) }
        },
        data: { status: OfferStatus.cancelled }
      });

      for (const offer of pendingOffers) {
        const cat = this.listingCategoryLabel(offer.listing.category);
        notices.push({
          buyerUserId: offer.buyerUserId,
          title: "Annonce annulée",
          body: `L'annonce ${cat} n'est plus disponible.`,
          listingId: offer.listingId
        });
      }
    }

    return { notices, listingIds };
  }

  async purgeListingsAfterFarmDelete(
    tx: Prisma.TransactionClient,
    listingIds: string[]
  ): Promise<void> {
    if (listingIds.length === 0) {
      return;
    }

    const transactions = await tx.marketplaceTransaction.findMany({
      where: { listingId: { in: listingIds } },
      select: { id: true }
    });
    const transactionIds = transactions.map((t) => t.id);

    if (transactionIds.length > 0) {
      await tx.platformRevenue.deleteMany({
        where: { transactionId: { in: transactionIds } }
      });
      await tx.marketplaceDeliveryDispute.deleteMany({
        where: { transactionId: { in: transactionIds } }
      });
      await tx.marketplaceFundMovement.deleteMany({
        where: { transactionId: { in: transactionIds } }
      });
      await tx.marketplacePendingTransfer.deleteMany({
        where: { transactionId: { in: transactionIds } }
      });
      await tx.marketplaceTransactionReceipt.deleteMany({
        where: { transactionId: { in: transactionIds } }
      });
      await tx.marketplaceTransaction.deleteMany({
        where: { id: { in: transactionIds } }
      });
    }

    await tx.marketplaceCreditArbitration.deleteMany({
      where: { listingId: { in: listingIds } }
    });
    await tx.marketplaceDeliveryDispute.deleteMany({
      where: { listingId: { in: listingIds } }
    });
    await tx.buyerFavorite.deleteMany({
      where: { listingId: { in: listingIds } }
    });
    await tx.marketplaceOffer.deleteMany({
      where: { listingId: { in: listingIds } }
    });

    const listingRooms = await tx.chatRoom.findMany({
      where: { marketplaceListingId: { in: listingIds } },
      select: { id: true }
    });
    const roomIds = listingRooms.map((r) => r.id);
    if (roomIds.length > 0) {
      await tx.chatMessage.deleteMany({ where: { roomId: { in: roomIds } } });
      await tx.chatRoomMember.deleteMany({ where: { roomId: { in: roomIds } } });
      await tx.chatRoom.deleteMany({ where: { id: { in: roomIds } } });
    }

    await tx.pigPriceIndexFlaggedListing.deleteMany({
      where: { listingId: { in: listingIds } }
    });

    await tx.marketplaceListing.deleteMany({
      where: { id: { in: listingIds } }
    });
  }

  dispatchBuyerNotices(notices: BuyerNotice[]): void {
    for (const n of notices) {
      void this.push.sendToUser(n.buyerUserId, n.title, n.body, {
        type: "marketplace_listing",
        listingId: n.listingId
      });
    }
  }

  /** Filtre public : annonces publiées, non expirées, ferme active si liée. */
  publicListingWhere(now = new Date()): Prisma.MarketplaceListingWhereInput {
    return {
      status: ListingStatus.published,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      AND: [
        {
          OR: [
            { farmId: null },
            { farm: { status: FarmStatus.active } }
          ]
        }
      ]
    };
  }
}
