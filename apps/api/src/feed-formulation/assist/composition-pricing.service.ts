import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { MerchantKind, type User } from "@prisma/client";
import { FarmAccessService } from "../../common/farm-access.service";
import { FARM_SCOPE } from "../../common/farm-scopes.constants";
import { PrismaService } from "../../prisma/prisma.service";
import {
  compareMillPriceEntries,
  DEFAULT_MILL_PRICE_RADIUS_KM,
  filterMillsByRadius,
  parseRationLines,
  priceCompositionAtMill,
  type OfferForPricing
} from "./composition-pricing.util";

export type MillCompositionPriceDto = {
  millId: string;
  millName: string;
  distanceKm: number | null;
  totalPriceXof: number;
  missingIngredients: Array<{
    feedIngredientId: string;
    canonicalName: string | null;
    requiredKg: number;
    reason: "no_offer" | "insufficient_stock";
    availableKg: number | null;
  }>;
  availabilityComplete: boolean;
  mixingCost: number;
};

export type MillPricesResponseDto = {
  compositionId: string;
  farmId: string;
  radiusKm: number;
  mills: MillCompositionPriceDto[];
};

/**
 * Comparaison de prix multi-moulins pour une SavedComposition validée (P-J4-A).
 * Lecture seule — source unique : MillIngredientOffer.
 */
@Injectable()
export class CompositionPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService
  ) {}

  async priceForMills(
    user: User,
    savedCompositionId: string,
    radiusKm?: number
  ): Promise<MillPricesResponseDto> {
    const composition = await this.requireProducerOwnerComposition(
      user,
      savedCompositionId
    );

    const farm = await this.prisma.farm.findUnique({
      where: { id: composition.farmId },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        departmentCode: true
      }
    });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }

    const ration = parseRationLines(composition.ration);
    if (ration.length === 0) {
      throw new BadRequestException(
        "Cette composition n’a aucun intrant à tarifer."
      );
    }

    const radius =
      radiusKm != null && Number.isFinite(radiusKm) && radiusKm > 0
        ? radiusKm
        : DEFAULT_MILL_PRICE_RADIUS_KM;

    const mills = await this.prisma.merchantProfile.findMany({
      where: {
        merchantKind: MerchantKind.mill,
        isActive: true
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        departmentCode: true,
        geoResolutionSource: true,
        user: {
          select: {
            fullName: true
          }
        },
        shops: {
          where: { archivedAt: null },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { name: true, locationLabel: true }
        },
        millIngredientOffers: {
          where: { isActive: true },
          select: {
            feedIngredientId: true,
            pricePerUnit: true,
            packaging: true,
            unitToKg: true,
            stockQuantity: true,
            mixingCostPerKg: true,
            feedIngredient: {
              select: { canonicalName: true, isActive: true }
            }
          }
        }
      }
    });

    const farmLat = decimalToNumber(farm.latitude);
    const farmLng = decimalToNumber(farm.longitude);

    // Géoloc MerchantProfile (P-10) — moulin unresolved sans coords/département exclu du rayon.
    const geoFiltered = filterMillsByRadius(
      {
        latitude: farmLat,
        longitude: farmLng,
        departmentCode: farm.departmentCode
      },
      mills.map((m) => ({
        millId: m.id,
        latitude: decimalToNumber(m.latitude),
        longitude: decimalToNumber(m.longitude),
        departmentCode: m.departmentCode
      })),
      radius
    ).filter((g) => g.inRadius);
    const byId = new Map(mills.map((m) => [m.id, m]));
    const entries: MillCompositionPriceDto[] = [];

    for (const geo of geoFiltered) {
      const mill = byId.get(geo.millId);
      if (!mill) continue;

      const offers: OfferForPricing[] = mill.millIngredientOffers
        .filter((o) => o.feedIngredient.isActive)
        .map((o) => ({
          feedIngredientId: o.feedIngredientId,
          canonicalName: o.feedIngredient.canonicalName,
          pricePerUnit: Number(o.pricePerUnit),
          packaging: o.packaging,
          unitToKg: Number(o.unitToKg),
          stockQuantity: Number(o.stockQuantity),
          mixingCostPerKg:
            o.mixingCostPerKg != null ? Number(o.mixingCostPerKg) : null
        }));

      const priced = priceCompositionAtMill(ration, offers);
      const millName =
        mill.shops[0]?.name?.trim() ||
        mill.user.fullName?.trim() ||
        "Moulin";

      entries.push({
        millId: mill.id,
        millName,
        distanceKm:
          geo.distanceKm != null
            ? Math.round(geo.distanceKm * 10) / 10
            : null,
        totalPriceXof: priced.totalPriceXof,
        missingIngredients: priced.missingIngredients,
        availabilityComplete: priced.availabilityComplete,
        mixingCost: priced.mixingCostXof
      });
    }

    entries.sort(compareMillPriceEntries);

    return {
      compositionId: composition.id,
      farmId: composition.farmId,
      radiusKm: radius,
      mills: entries
    };
  }

  /**
   * Producteur propriétaire / membre autorisé (finance.write) uniquement.
   * Véto / technicien / lecture seule → 403.
   */
  private async requireProducerOwnerComposition(
    user: User,
    compositionId: string
  ) {
    const row = await this.prisma.savedComposition.findUnique({
      where: { id: compositionId }
    });
    if (!row) {
      throw new NotFoundException("Composition introuvable");
    }
    if (row.status !== "validated") {
      throw new BadRequestException(
        "Seules les compositions validées peuvent être tarifées chez les moulins."
      );
    }
    try {
      await this.farmAccess.requireFarmScopes(user.id, row.farmId, [
        FARM_SCOPE.financeWrite
      ]);
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw new ForbiddenException(
          "Seul le producteur propriétaire (ou un membre autorisé) peut comparer les prix moulins."
        );
      }
      throw err;
    }
    return row;
  }
}

function decimalToNumber(
  v: { toNumber?: () => number } | number | string | null | undefined
): number | null {
  if (v == null) return null;
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? Number(v)
        : typeof v.toNumber === "function"
          ? v.toNumber()
          : Number(v);
  return Number.isFinite(n) ? n : null;
}
