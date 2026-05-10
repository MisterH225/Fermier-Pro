import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { PrismaService } from "../prisma/prisma.service";
import { ConsumeFeedStockDto } from "./dto/consume-feed-stock.dto";
import { CreateFeedStockLotDto } from "./dto/create-feed-stock-lot.dto";

@Injectable()
export class FeedStockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService
  ) {}

  async list(user: User, farmId: string) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockRead
    ]);
    return this.prisma.feedStockLot.findMany({
      where: { farmId },
      orderBy: [{ purchasedAt: "desc" }, { createdAt: "desc" }],
      include: {
        creator: { select: { id: true, fullName: true } }
      }
    });
  }

  async create(user: User, farmId: string, dto: CreateFeedStockLotDto) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockWrite
    ]);
    const qty = new Prisma.Decimal(dto.quantityKg);
    return this.prisma.feedStockLot.create({
      data: {
        farmId,
        productName: dto.productName.trim(),
        quantityKg: qty,
        remainingKg: qty,
        purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : new Date(),
        supplierName: dto.supplierName?.trim() || null,
        unitPrice:
          dto.unitPrice != null ? new Prisma.Decimal(dto.unitPrice) : null,
        currency: dto.currency ?? "XOF",
        notes: dto.notes?.trim() || null,
        createdByUserId: user.id
      },
      include: {
        creator: { select: { id: true, fullName: true } }
      }
    });
  }

  async consume(
    user: User,
    farmId: string,
    lotId: string,
    dto: ConsumeFeedStockDto
  ) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockWrite
    ]);
    const lot = await this.prisma.feedStockLot.findFirst({
      where: { id: lotId, farmId }
    });
    if (!lot) {
      throw new NotFoundException("Lot introuvable");
    }
    const take = new Prisma.Decimal(dto.kg);
    if (lot.remainingKg.lessThan(take)) {
      throw new BadRequestException("Stock insuffisant pour cette consommation");
    }
    const next = lot.remainingKg.minus(take);
    return this.prisma.feedStockLot.update({
      where: { id: lotId },
      data: { remainingKg: next },
      include: {
        creator: { select: { id: true, fullName: true } }
      }
    });
  }
}
