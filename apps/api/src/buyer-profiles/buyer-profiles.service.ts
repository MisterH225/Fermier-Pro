import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  ListingStatus,
  MarketplaceTransactionStatus,
  OfferStatus,
  Prisma,
  ProfileType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateBuyerPriceAlertDto } from "./dto/create-price-alert.dto";
import type { UpdateBuyerPriceAlertDto } from "./dto/update-price-alert.dto";
import type { UpsertBuyerProfileDto } from "./dto/upsert-buyer-profile.dto";

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class BuyerProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureRow(userId: string) {
    return this.prisma.buyerProfile.upsert({
      where: { userId },
      create: { userId },
      update: {}
    });
  }

  async upsertMe(user: User, dto: UpsertBuyerProfileDto) {
    await this.ensureProfileType(user.id, ProfileType.buyer);
    return this.prisma.buyerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        buyerType: dto.buyerType ?? "individual",
        businessName: dto.businessName,
        locationLabel: dto.locationLabel,
        homeLatitude:
          dto.homeLatitude != null
            ? new Prisma.Decimal(dto.homeLatitude)
            : undefined,
        homeLongitude:
          dto.homeLongitude != null
            ? new Prisma.Decimal(dto.homeLongitude)
            : undefined,
        searchRadiusKm: dto.searchRadiusKm,
        preferredCategories: dto.preferredCategories ?? [],
        priceRangeMin:
          dto.priceRangeMin != null
            ? new Prisma.Decimal(dto.priceRangeMin)
            : undefined,
        priceRangeMax:
          dto.priceRangeMax != null
            ? new Prisma.Decimal(dto.priceRangeMax)
            : undefined,
        typicalVolume: dto.typicalVolume,
        profilePhotoUrl: dto.profilePhotoUrl,
        onboardingComplete: dto.onboardingComplete ?? false
      },
      update: {
        ...(dto.buyerType !== undefined ? { buyerType: dto.buyerType } : {}),
        ...(dto.businessName !== undefined
          ? { businessName: dto.businessName }
          : {}),
        ...(dto.locationLabel !== undefined
          ? { locationLabel: dto.locationLabel }
          : {}),
        ...(dto.homeLatitude !== undefined
          ? { homeLatitude: new Prisma.Decimal(dto.homeLatitude) }
          : {}),
        ...(dto.homeLongitude !== undefined
          ? { homeLongitude: new Prisma.Decimal(dto.homeLongitude) }
          : {}),
        ...(dto.searchRadiusKm !== undefined
          ? { searchRadiusKm: dto.searchRadiusKm }
          : {}),
        ...(dto.preferredCategories !== undefined
          ? { preferredCategories: dto.preferredCategories }
          : {}),
        ...(dto.priceRangeMin !== undefined
          ? { priceRangeMin: new Prisma.Decimal(dto.priceRangeMin) }
          : {}),
        ...(dto.priceRangeMax !== undefined
          ? { priceRangeMax: new Prisma.Decimal(dto.priceRangeMax) }
          : {}),
        ...(dto.typicalVolume !== undefined
          ? { typicalVolume: dto.typicalVolume }
          : {}),
        ...(dto.profilePhotoUrl !== undefined
          ? { profilePhotoUrl: dto.profilePhotoUrl }
          : {}),
        ...(dto.onboardingComplete !== undefined
          ? { onboardingComplete: dto.onboardingComplete }
          : {})
      }
    });
  }

  async dashboard(user: User) {
    const profile = await this.prisma.buyerProfile.findUnique({
      where: { userId: user.id }
    });
    const [
      pendingProposals,
      completedPurchases,
      activeAlerts,
      favoritesCount
    ] = await Promise.all([
      this.prisma.marketplaceOffer.count({
        where: { buyerUserId: user.id, status: OfferStatus.pending }
      }),
      this.prisma.marketplaceTransaction.count({
        where: {
          buyerUserId: user.id,
          status: MarketplaceTransactionStatus.TRANSACTION_CLOSED
        }
      }),
      this.prisma.buyerPriceAlert.count({
        where: {
          buyerProfile: { userId: user.id },
          isActive: true
        }
      }),
      profile
        ? this.prisma.buyerFavorite.count({ where: { buyerProfileId: profile.id } })
        : Promise.resolve(0)
    ]);

    return {
      profile: profile
        ? {
            buyerType: profile.buyerType,
            onboardingComplete: profile.onboardingComplete,
            preferredCategories: profile.preferredCategories,
            priceRangeMin: profile.priceRangeMin?.toString() ?? null,
            priceRangeMax: profile.priceRangeMax?.toString() ?? null
          }
        : null,
      kpis: {
        pendingProposals,
        purchasesCount: completedPurchases,
        favoritesCount,
        activeAlerts
      }
    };
  }

  async listProposals(user: User, status?: OfferStatus) {
    const where: Prisma.MarketplaceOfferWhereInput = {
      buyerUserId: user.id
    };
    if (status) {
      where.status = status;
    }
    const rows = await this.prisma.marketplaceOffer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        listing: {
          include: {
            farm: { select: { id: true, name: true } },
            seller: { select: { id: true, fullName: true } }
          }
        }
      }
    });
    return rows.map((o) => ({
      id: o.id,
      status: o.status,
      offeredPrice: o.offeredPrice.toString(),
      proposedPricePerKg: o.proposedPricePerKg?.toString() ?? null,
      quantity: o.quantity,
      message: o.message,
      counterPricePerKg: o.counterPricePerKg?.toString() ?? null,
      createdAt: o.createdAt.toISOString(),
      listing: {
        id: o.listing.id,
        title: o.listing.title,
        category: o.listing.category,
        status: o.listing.status,
        pricePerKg: o.listing.pricePerKg?.toString() ?? null,
        farmName: o.listing.farm?.name ?? null,
        sellerName: o.listing.seller.fullName
      }
    }));
  }

  async personalizedListings(user: User) {
    const profile = await this.prisma.buyerProfile.findUnique({
      where: { userId: user.id }
    });
    const cats = (profile?.preferredCategories as string[] | null) ?? [];
    const minPrice = profile?.priceRangeMin?.toNumber();
    const maxPrice = profile?.priceRangeMax?.toNumber();

    const listings = await this.prisma.marketplaceListing.findMany({
      where: {
        status: ListingStatus.published,
        sellerUserId: { not: user.id },
        ...(cats.length > 0 ? { category: { in: cats as never[] } } : {})
      },
      orderBy: { publishedAt: "desc" },
      take: 40,
      include: {
        farm: { select: { id: true, name: true } }
      }
    });

    return listings
      .filter((l) => {
        const ppk = l.pricePerKg?.toNumber();
        if (ppk == null) {
          return true;
        }
        if (minPrice != null && ppk < minPrice) {
          return false;
        }
        if (maxPrice != null && ppk > maxPrice) {
          return false;
        }
        return true;
      })
      .slice(0, 20)
      .map((l) => ({
        id: l.id,
        title: l.title,
        category: l.category,
        pricePerKg: l.pricePerKg?.toString() ?? null,
        totalPrice: l.totalPrice?.toString() ?? null,
        weightKg: l.totalWeightKg?.toString() ?? null,
        farmName: l.farm?.name ?? null,
        publishedAt: l.publishedAt?.toISOString() ?? null,
        photoUrls: l.photoUrls
      }));
  }

  async listPriceAlerts(user: User) {
    const profile = await this.ensureRow(user.id);
    const rows = await this.prisma.buyerPriceAlert.findMany({
      where: { buyerProfileId: profile.id },
      orderBy: { createdAt: "desc" }
    });
    return Promise.all(
      rows.map((row) => this.serializePriceAlert(user, row, profile))
    );
  }

  private resolveListingCategories(animalCategory: string) {
    if (
      animalCategory === "breeder_male" ||
      animalCategory === "breeder_female"
    ) {
      return ["breeder"] as const;
    }
    const known = ["piglet", "breeder", "butcher", "reformed"] as const;
    if ((known as readonly string[]).includes(animalCategory)) {
      return [animalCategory as (typeof known)[number]];
    }
    return [] as const;
  }

  private async countMatchingListings(
    user: User,
    alert: {
      animalCategory: string;
      maxPricePerKg: { toNumber(): number };
      minWeightKg: { toNumber(): number } | null;
      radiusKm: number | null;
    },
    profile: {
      homeLatitude: { toNumber(): number } | null;
      homeLongitude: { toNumber(): number } | null;
    }
  ): Promise<number> {
    const categories = this.resolveListingCategories(alert.animalCategory);
    const maxPrice = alert.maxPricePerKg.toNumber();
    const minWeight = alert.minWeightKg?.toNumber() ?? null;
    const radiusKm = alert.radiusKm;
    const homeLat = profile.homeLatitude?.toNumber() ?? null;
    const homeLng = profile.homeLongitude?.toNumber() ?? null;

    const listings = await this.prisma.marketplaceListing.findMany({
      where: {
        status: ListingStatus.published,
        sellerUserId: { not: user.id },
        ...(categories.length ? { category: { in: [...categories] } } : {}),
        OR: [
          { pricePerKg: null },
          { pricePerKg: { lte: new Prisma.Decimal(maxPrice) } }
        ]
      },
      include: {
        farm: { select: { latitude: true, longitude: true } }
      }
    });

    return listings.filter((listing) => {
      if (minWeight != null) {
        const weight = listing.totalWeightKg?.toNumber();
        if (weight != null && weight < minWeight) {
          return false;
        }
      }
      if (
        radiusKm != null &&
        homeLat != null &&
        homeLng != null &&
        listing.farm?.latitude != null &&
        listing.farm?.longitude != null
      ) {
        const farmLat = listing.farm.latitude.toNumber();
        const farmLng = listing.farm.longitude.toNumber();
        if (haversineKm(homeLat, homeLng, farmLat, farmLng) > radiusKm) {
          return false;
        }
      }
      return true;
    }).length;
  }

  private async serializePriceAlert(
    user: User,
    row: {
      id: string;
      animalCategory: string;
      maxPricePerKg: { toNumber(): number; toString(): string };
      minWeightKg: { toNumber(): number; toString(): string } | null;
      radiusKm: number | null;
      notificationFrequency: string;
      isActive: boolean;
      createdAt: Date;
    },
    profile: {
      homeLatitude: { toNumber(): number } | null;
      homeLongitude: { toNumber(): number } | null;
    }
  ) {
    const matchingListingsCount = await this.countMatchingListings(
      user,
      row,
      profile
    );
    return {
      id: row.id,
      animalCategory: row.animalCategory,
      maxPricePerKg: row.maxPricePerKg.toString(),
      minWeightKg: row.minWeightKg?.toString() ?? null,
      radiusKm: row.radiusKm,
      notificationFrequency: row.notificationFrequency,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      matchingListingsCount
    };
  }

  async createPriceAlert(user: User, dto: CreateBuyerPriceAlertDto) {
    const profile = await this.ensureRow(user.id);
    const row = await this.prisma.buyerPriceAlert.create({
      data: {
        buyerProfileId: profile.id,
        animalCategory: dto.animalCategory,
        maxPricePerKg: new Prisma.Decimal(dto.maxPricePerKg),
        minWeightKg:
          dto.minWeightKg != null
            ? new Prisma.Decimal(dto.minWeightKg)
            : null,
        radiusKm: dto.radiusKm,
        notificationFrequency: dto.notificationFrequency ?? "immediate",
        isActive: dto.isActive ?? true
      }
    });
    return this.serializePriceAlert(user, row, profile);
  }

  async updatePriceAlert(
    user: User,
    id: string,
    dto: UpdateBuyerPriceAlertDto
  ) {
    const profile = await this.ensureRow(user.id);
    const existing = await this.prisma.buyerPriceAlert.findFirst({
      where: { id, buyerProfileId: profile.id }
    });
    if (!existing) {
      throw new NotFoundException("Alerte introuvable");
    }
    const row = await this.prisma.buyerPriceAlert.update({
      where: { id },
      data: {
        ...(dto.animalCategory !== undefined
          ? { animalCategory: dto.animalCategory }
          : {}),
        ...(dto.maxPricePerKg !== undefined
          ? { maxPricePerKg: new Prisma.Decimal(dto.maxPricePerKg) }
          : {}),
        ...(dto.minWeightKg !== undefined
          ? {
              minWeightKg:
                dto.minWeightKg != null
                  ? new Prisma.Decimal(dto.minWeightKg)
                  : null
            }
          : {}),
        ...(dto.radiusKm !== undefined ? { radiusKm: dto.radiusKm } : {}),
        ...(dto.notificationFrequency !== undefined
          ? { notificationFrequency: dto.notificationFrequency }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      }
    });
    return this.serializePriceAlert(user, row, profile);
  }

  async deletePriceAlert(user: User, id: string) {
    const profile = await this.ensureRow(user.id);
    const existing = await this.prisma.buyerPriceAlert.findFirst({
      where: { id, buyerProfileId: profile.id }
    });
    if (!existing) {
      throw new NotFoundException("Alerte introuvable");
    }
    await this.prisma.buyerPriceAlert.delete({ where: { id } });
    return { ok: true };
  }


  async listPurchases(user: User) {
    return this.listProposals(user, OfferStatus.completed);
  }

  async listReviews(user: User) {
    const rows = await this.prisma.farmMarketRating.findMany({
      where: { ratedByUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        farm: { select: { id: true, name: true } }
      }
    });
    return rows.map((r) => ({
      id: r.id,
      score: r.score,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      farmId: r.farmId,
      farmName: r.farm.name
    }));
  }


  async listFavoriteIds(user: User) {
    const profile = await this.ensureRow(user.id);
    const rows = await this.prisma.buyerFavorite.findMany({
      where: { buyerProfileId: profile.id },
      select: { listingId: true },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((r) => r.listingId);
  }

  async listFavorites(user: User) {
    const profile = await this.ensureRow(user.id);
    const rows = await this.prisma.buyerFavorite.findMany({
      where: { buyerProfileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        listing: {
          include: {
            farm: { select: { id: true, name: true } }
          }
        }
      }
    });
    return rows
      .filter(
        (f) =>
          f.listing.sellerUserId !== user.id &&
          f.listing.status === ListingStatus.published
      )
      .map((f) => ({
        favoriteId: f.id,
        favoritedAt: f.createdAt.toISOString(),
        id: f.listing.id,
        title: f.listing.title,
        category: f.listing.category,
        pricePerKg: f.listing.pricePerKg?.toString() ?? null,
        totalPrice: f.listing.totalPrice?.toString() ?? null,
        weightKg: f.listing.totalWeightKg?.toString() ?? null,
        farmName: f.listing.farm?.name ?? null,
        photoUrls: f.listing.photoUrls,
        publishedAt: f.listing.publishedAt?.toISOString() ?? null
      }));
  }

  async addFavorite(user: User, listingId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId }
    });
    if (!listing) {
      throw new NotFoundException("Annonce introuvable");
    }
    if (listing.sellerUserId === user.id) {
      throw new BadRequestException("Impossible de favoriser votre propre annonce");
    }
    const profile = await this.ensureRow(user.id);
    const row = await this.prisma.buyerFavorite.upsert({
      where: {
        buyerProfileId_listingId: {
          buyerProfileId: profile.id,
          listingId
        }
      },
      create: {
        buyerProfileId: profile.id,
        listingId
      },
      update: {}
    });
    return { ok: true, listingId, favoriteId: row.id };
  }

  async removeFavorite(user: User, listingId: string) {
    const profile = await this.ensureRow(user.id);
    const existing = await this.prisma.buyerFavorite.findUnique({
      where: {
        buyerProfileId_listingId: {
          buyerProfileId: profile.id,
          listingId
        }
      }
    });
    if (!existing) {
      throw new NotFoundException("Favori introuvable");
    }
    await this.prisma.buyerFavorite.delete({ where: { id: existing.id } });
    return { ok: true };
  }

  private async ensureProfileType(userId: string, type: ProfileType) {
    const p = await this.prisma.profile.findFirst({
      where: { userId, type }
    });
    if (!p) {
      throw new NotFoundException("Profil acheteur introuvable");
    }
  }
}
