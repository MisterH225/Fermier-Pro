import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFarmRatingDto } from "./dto/create-farm-rating.dto";

@Injectable()
export class FarmRatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrUpdate(user: User, dto: CreateFarmRatingDto) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: dto.farmId }
    });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }
    if (farm.ownerId === user.id) {
      throw new BadRequestException(
        "Tu ne peux pas noter ta propre exploitation depuis ce flux"
      );
    }
    return this.prisma.farmMarketRating.upsert({
      where: {
        farmId_ratedByUserId: {
          farmId: dto.farmId,
          ratedByUserId: user.id
        }
      },
      create: {
        farmId: dto.farmId,
        ratedByUserId: user.id,
        score: dto.score,
        comment: dto.comment?.trim() || null
      },
      update: {
        score: dto.score,
        comment: dto.comment?.trim() || null
      }
    });
  }

  async averageForFarm(farmId: string): Promise<{ avg: number | null; count: number }> {
    const agg = await this.prisma.farmMarketRating.aggregate({
      where: { farmId },
      _avg: { score: true },
      _count: { _all: true }
    });
    const avg = agg._avg.score;
    return {
      avg: avg != null ? Number(avg.toFixed(2)) : null,
      count: agg._count._all
    };
  }
}
