import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef
} from "@nestjs/common";
import {
  MembershipRole,
  MerchantOrderStatus,
  MarketplaceTransactionStatus,
  TrustScoreProfileType,
  type User
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RATING_EDIT_WINDOW_DAYS } from "../trust-score/trust-score.constants";
import { TrustScoreService } from "../trust-score/trust-score.service";
import type { AdminDeleteRatingDto } from "./dto/admin-delete-rating.dto";
import type { CreateBuyerRatingDto } from "./dto/create-buyer-rating.dto";
import type { CreateMerchantRatingDto } from "./dto/create-merchant-rating.dto";
import type { CreateTechnicianRatingDto } from "./dto/create-technician-rating.dto";

const OWNER_LIKE_ROLES: MembershipRole[] = [
  MembershipRole.owner,
  MembershipRole.manager
];

export type RatingSummary = { avg: number | null; count: number };

@Injectable()
export class CrossRatingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => TrustScoreService))
    private readonly trustScore?: TrustScoreService
  ) {}

  private withinEditWindow(createdAt: Date, now = new Date()): boolean {
    const ms = RATING_EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return now.getTime() - createdAt.getTime() <= ms;
  }

  private currentPeriodYearMonth(now = new Date()): string {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  private toSummary(avg: number | null | undefined, count: number): RatingSummary {
    return {
      avg: avg != null ? Number(Number(avg).toFixed(2)) : null,
      count
    };
  }

  private async refreshBuyerProfileRatings(buyerUserId: string): Promise<void> {
    const agg = await this.prisma.buyerRating.aggregate({
      where: { buyerUserId },
      _avg: { score: true },
      _count: true
    });
    await this.prisma.buyerProfile.updateMany({
      where: { userId: buyerUserId },
      data: {
        ratingAvg: agg._avg.score ?? null,
        ratingCount: agg._count
      }
    });
  }

  private async maybeRecompute(
    userId: string,
    profileType: TrustScoreProfileType
  ): Promise<void> {
    if (!this.trustScore) {
      // TODO: cron trust-score pickera le recalcul si injection indisponible
      return;
    }
    try {
      await this.trustScore.recomputeAndSnapshot(userId, profileType);
    } catch {
      // Soft fail — le cron rattrape
    }
  }

  async createBuyerRating(user: User, dto: CreateBuyerRatingDto) {
    const txId = dto.marketplaceTransactionId?.trim() || null;
    const orderId = dto.merchantOrderId?.trim() || null;
    if ((!txId && !orderId) || (txId && orderId)) {
      throw new BadRequestException(
        "Indiquez une transaction ou une commande, pas les deux"
      );
    }

    const comment = dto.comment?.trim() || null;
    let buyerUserId: string;
    let existing:
      | { id: string; createdAt: Date; ratedByUserId: string }
      | null;

    if (txId) {
      const tx = await this.prisma.marketplaceTransaction.findUnique({
        where: { id: txId },
        include: { buyerRating: true }
      });
      if (!tx) {
        throw new NotFoundException("Transaction introuvable");
      }
      if (tx.status !== MarketplaceTransactionStatus.TRANSACTION_CLOSED) {
        throw new BadRequestException("Transaction non clôturée");
      }
      if (tx.sellerUserId !== user.id) {
        throw new ForbiddenException("Seul le vendeur peut noter l'acheteur");
      }
      buyerUserId = tx.buyerUserId;
      existing = tx.buyerRating;
    } else {
      const order = await this.prisma.merchantOrder.findUnique({
        where: { id: orderId! },
        include: { buyerRating: true }
      });
      if (!order) {
        throw new NotFoundException("Commande introuvable");
      }
      if (order.status !== MerchantOrderStatus.completed) {
        throw new BadRequestException("Commande non terminée");
      }
      if (order.sellerUserId !== user.id) {
        throw new ForbiddenException("Seul le vendeur peut noter l'acheteur");
      }
      buyerUserId = order.buyerUserId;
      existing = order.buyerRating;
    }

    if (existing) {
      if (existing.ratedByUserId !== user.id) {
        throw new ForbiddenException("Avis déjà déposé");
      }
      if (!this.withinEditWindow(existing.createdAt)) {
        throw new BadRequestException("Délai de modification dépassé");
      }
      const updated = await this.prisma.buyerRating.update({
        where: { id: existing.id },
        data: { score: dto.score, comment }
      });
      await this.refreshBuyerProfileRatings(buyerUserId);
      await this.maybeRecompute(buyerUserId, TrustScoreProfileType.buyer);
      return updated;
    }

    const created = await this.prisma.buyerRating.create({
      data: {
        buyerUserId,
        ratedByUserId: user.id,
        marketplaceTransactionId: txId,
        merchantOrderId: orderId,
        score: dto.score,
        comment
      }
    });
    await this.refreshBuyerProfileRatings(buyerUserId);
    await this.maybeRecompute(buyerUserId, TrustScoreProfileType.buyer);
    return created;
  }

  async createMerchantRating(user: User, dto: CreateMerchantRatingDto) {
    const order = await this.prisma.merchantOrder.findUnique({
      where: { id: dto.merchantOrderId },
      include: { merchantRating: true }
    });
    if (!order) {
      throw new NotFoundException("Commande introuvable");
    }
    if (order.status !== MerchantOrderStatus.completed) {
      throw new BadRequestException("Commande non terminée");
    }
    if (order.buyerUserId !== user.id) {
      throw new ForbiddenException("Seul l'acheteur peut noter le commerçant");
    }

    const comment = dto.comment?.trim() || null;
    const existing = order.merchantRating;

    if (existing) {
      if (existing.ratedByUserId !== user.id) {
        throw new ForbiddenException("Avis déjà déposé");
      }
      if (!this.withinEditWindow(existing.createdAt)) {
        throw new BadRequestException("Délai de modification dépassé");
      }
      const updated = await this.prisma.merchantRating.update({
        where: { id: existing.id },
        data: { score: dto.score, comment }
      });
      await this.maybeRecompute(
        order.sellerUserId,
        TrustScoreProfileType.merchant
      );
      return updated;
    }

    const created = await this.prisma.merchantRating.create({
      data: {
        merchantUserId: order.sellerUserId,
        ratedByUserId: user.id,
        merchantOrderId: order.id,
        score: dto.score,
        comment
      }
    });
    await this.maybeRecompute(
      order.sellerUserId,
      TrustScoreProfileType.merchant
    );
    return created;
  }

  private async assertOwnerLike(userId: string, farmId: string) {
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }
    if (farm.ownerId === userId) {
      return farm;
    }
    const membership = await this.prisma.farmMembership.findFirst({
      where: {
        farmId,
        userId,
        archived: false,
        role: { in: OWNER_LIKE_ROLES }
      }
    });
    if (!membership) {
      throw new ForbiddenException("Accès refusé");
    }
    return farm;
  }

  async createTechnicianRating(user: User, dto: CreateTechnicianRatingDto) {
    if (dto.technicianUserId === user.id) {
      throw new BadRequestException("Vous ne pouvez pas vous noter");
    }
    await this.assertOwnerLike(user.id, dto.farmId);

    const techMembership = await this.prisma.farmMembership.findFirst({
      where: {
        farmId: dto.farmId,
        userId: dto.technicianUserId,
        archived: false
      }
    });
    if (!techMembership) {
      throw new BadRequestException("Technicien non membre de cette ferme");
    }

    const periodYearMonth = this.currentPeriodYearMonth();
    const comment = dto.comment?.trim() || null;

    const existing = await this.prisma.technicianRating.findUnique({
      where: {
        technicianUserId_ratedByUserId_farmId_periodYearMonth: {
          technicianUserId: dto.technicianUserId,
          ratedByUserId: user.id,
          farmId: dto.farmId,
          periodYearMonth
        }
      }
    });

    if (existing) {
      throw new BadRequestException("Avis déjà déposé ce mois-ci");
    }

    const created = await this.prisma.technicianRating.create({
      data: {
        technicianUserId: dto.technicianUserId,
        ratedByUserId: user.id,
        farmId: dto.farmId,
        periodYearMonth,
        score: dto.score,
        comment
      }
    });
    await this.maybeRecompute(
      dto.technicianUserId,
      TrustScoreProfileType.technician
    );
    return created;
  }

  async buyerSummary(userId: string): Promise<RatingSummary> {
    const agg = await this.prisma.buyerRating.aggregate({
      where: { buyerUserId: userId },
      _avg: { score: true },
      _count: true
    });
    return this.toSummary(agg._avg.score, agg._count);
  }

  async merchantSummary(userId: string): Promise<RatingSummary> {
    const agg = await this.prisma.merchantRating.aggregate({
      where: { merchantUserId: userId },
      _avg: { score: true },
      _count: true
    });
    return this.toSummary(agg._avg.score, agg._count);
  }

  async technicianSummary(userId: string): Promise<RatingSummary> {
    const agg = await this.prisma.technicianRating.aggregate({
      where: { technicianUserId: userId },
      _avg: { score: true },
      _count: true
    });
    return this.toSummary(agg._avg.score, agg._count);
  }

  async listPending(user: User) {
    const periodYearMonth = this.currentPeriodYearMonth();

    const [marketplaceAsSeller, merchantAsSeller, merchantAsBuyer, ownedFarms] =
      await Promise.all([
        this.prisma.marketplaceTransaction.findMany({
          where: {
            sellerUserId: user.id,
            status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
            buyerRating: null
          },
          select: {
            id: true,
            buyerUserId: true,
            closedAt: true,
            createdAt: true
          },
          orderBy: { closedAt: "desc" },
          take: 50
        }),
        this.prisma.merchantOrder.findMany({
          where: {
            sellerUserId: user.id,
            status: MerchantOrderStatus.completed,
            buyerRating: null
          },
          select: {
            id: true,
            buyerUserId: true,
            completedAt: true,
            createdAt: true
          },
          orderBy: { completedAt: "desc" },
          take: 50
        }),
        this.prisma.merchantOrder.findMany({
          where: {
            buyerUserId: user.id,
            status: MerchantOrderStatus.completed,
            merchantRating: null
          },
          select: {
            id: true,
            sellerUserId: true,
            completedAt: true,
            createdAt: true
          },
          orderBy: { completedAt: "desc" },
          take: 50
        }),
        this.prisma.farm.findMany({
          where: {
            OR: [
              { ownerId: user.id },
              {
                memberships: {
                  some: {
                    userId: user.id,
                    archived: false,
                    role: { in: OWNER_LIKE_ROLES }
                  }
                }
              }
            ]
          },
          select: { id: true, name: true, ownerId: true }
        })
      ]);

    const farmIds = ownedFarms.map((f) => f.id);
    let technicianPending: Array<{
      farmId: string;
      farmName: string;
      technicianUserId: string;
      technicianName: string | null;
      periodYearMonth: string;
    }> = [];

    if (farmIds.length > 0) {
      const members = await this.prisma.farmMembership.findMany({
        where: {
          farmId: { in: farmIds },
          archived: false,
          userId: { not: user.id },
          role: { not: MembershipRole.owner },
          user: { technicianProfile: { isNot: null } }
        },
        select: {
          farmId: true,
          userId: true,
          user: { select: { fullName: true } },
          farm: { select: { name: true } }
        }
      });

      const existing = await this.prisma.technicianRating.findMany({
        where: {
          ratedByUserId: user.id,
          farmId: { in: farmIds },
          periodYearMonth,
          technicianUserId: { in: members.map((m) => m.userId) }
        },
        select: { technicianUserId: true, farmId: true }
      });
      const ratedKeys = new Set(
        existing.map((e) => `${e.farmId}:${e.technicianUserId}`)
      );

      technicianPending = members
        .filter((m) => !ratedKeys.has(`${m.farmId}:${m.userId}`))
        .map((m) => ({
          farmId: m.farmId,
          farmName: m.farm.name,
          technicianUserId: m.userId,
          technicianName: m.user.fullName,
          periodYearMonth
        }));
    }

    return {
      buyerRatings: [
        ...marketplaceAsSeller.map((t) => ({
          kind: "marketplace" as const,
          marketplaceTransactionId: t.id,
          merchantOrderId: null,
          buyerUserId: t.buyerUserId,
          closedAt: t.closedAt?.toISOString() ?? null
        })),
        ...merchantAsSeller.map((o) => ({
          kind: "merchant_order" as const,
          marketplaceTransactionId: null,
          merchantOrderId: o.id,
          buyerUserId: o.buyerUserId,
          closedAt: o.completedAt?.toISOString() ?? null
        }))
      ],
      merchantRatings: merchantAsBuyer.map((o) => ({
        merchantOrderId: o.id,
        merchantUserId: o.sellerUserId,
        completedAt: o.completedAt?.toISOString() ?? null
      })),
      technicianRatings: technicianPending
    };
  }

  async adminDelete(
    admin: User,
    type: string,
    id: string,
    dto: AdminDeleteRatingDto
  ) {
    const ratingType = type.trim().toLowerCase();
    if (
      ratingType !== "buyer" &&
      ratingType !== "merchant" &&
      ratingType !== "technician"
    ) {
      throw new BadRequestException("Type d'avis invalide");
    }

    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException("Motif requis");
    }

    if (ratingType === "buyer") {
      const row = await this.prisma.buyerRating.findUnique({ where: { id } });
      if (!row) {
        throw new NotFoundException("Avis introuvable");
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.crossRatingModerationLog.create({
          data: {
            ratingType: "buyer",
            ratingId: row.id,
            adminUserId: admin.id,
            reason,
            ratingSnapshot: row
          }
        });
        await tx.buyerRating.delete({ where: { id: row.id } });
      });
      await this.refreshBuyerProfileRatings(row.buyerUserId);
      await this.maybeRecompute(row.buyerUserId, TrustScoreProfileType.buyer);
      return { ok: true };
    }

    if (ratingType === "merchant") {
      const row = await this.prisma.merchantRating.findUnique({
        where: { id }
      });
      if (!row) {
        throw new NotFoundException("Avis introuvable");
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.crossRatingModerationLog.create({
          data: {
            ratingType: "merchant",
            ratingId: row.id,
            adminUserId: admin.id,
            reason,
            ratingSnapshot: row
          }
        });
        await tx.merchantRating.delete({ where: { id: row.id } });
      });
      await this.maybeRecompute(
        row.merchantUserId,
        TrustScoreProfileType.merchant
      );
      return { ok: true };
    }

    const row = await this.prisma.technicianRating.findUnique({
      where: { id }
    });
    if (!row) {
      throw new NotFoundException("Avis introuvable");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.crossRatingModerationLog.create({
        data: {
          ratingType: "technician",
          ratingId: row.id,
          adminUserId: admin.id,
          reason,
          ratingSnapshot: row
        }
      });
      await tx.technicianRating.delete({ where: { id: row.id } });
    });
    await this.maybeRecompute(
      row.technicianUserId,
      TrustScoreProfileType.technician
    );
    return { ok: true };
  }
}
