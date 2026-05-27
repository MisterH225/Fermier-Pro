import {
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  ListingStatus,
  OfferStatus,
  Prisma,
  ProfileType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateBuyerPriceAlertDto } from "./dto/create-price-alert.dto";
import type { UpsertBuyerProfileDto } from "./dto/upsert-buyer-profile.dto";

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
      acceptedOffers,
      activeAlerts,
      favoritesCount
    ] = await Promise.all([
      this.prisma.marketplaceOffer.count({
        where: { buyerUserId: user.id, status: OfferStatus.pending }
      }),
      this.prisma.marketplaceOffer.count({
        where: {
          buyerUserId: user.id,
          status: { in: [OfferStatus.accepted, OfferStatus.countered] }
        }
      }),
      this.prisma.buyerPriceAlert.count({
        where: {
          buyerProfile: { userId: user.id },
          isActive: true
        }
      }),
      Promise.resolve(0)
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
        purchasesCount: acceptedOffers,
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
    return rows.map((a) => ({
      id: a.id,
      animalCategory: a.animalCategory,
      maxPricePerKg: a.maxPricePerKg.toString(),
      minWeightKg: a.minWeightKg?.toString() ?? null,
      radiusKm: a.radiusKm,
      notificationFrequency: a.notificationFrequency,
      isActive: a.isActive,
      createdAt: a.createdAt.toISOString()
    }));
  }

  async createPriceAlert(user: User, dto: CreateBuyerPriceAlertDto) {
    const profile = await this.ensureRow(user.id);
    return this.prisma.buyerPriceAlert.create({
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
