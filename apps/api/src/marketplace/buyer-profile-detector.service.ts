import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type BuyerMarketplaceProfileKind =
  | "PLATFORM_USER_WITH_FARM"
  | "PLATFORM_USER_WITHOUT_FARM"
  | "EXTERNAL_BUYER";

export type BuyerMarketplaceProfile = {
  kind: BuyerMarketplaceProfileKind;
  buyerFarmId: string | null;
};

@Injectable()
export class BuyerProfileDetectorService {
  constructor(private readonly prisma: PrismaService) {}

  async detect(
    buyerUserId: string,
    offerBuyerFarmId?: string | null
  ): Promise<BuyerMarketplaceProfile> {
    const farmId = offerBuyerFarmId?.trim() || null;
    if (farmId) {
      const farm = await this.prisma.farm.findFirst({
        where: {
          id: farmId,
          OR: [
            { ownerId: buyerUserId },
            { memberships: { some: { userId: buyerUserId } } }
          ]
        },
        select: { id: true }
      });
      if (farm) {
        return { kind: "PLATFORM_USER_WITH_FARM", buyerFarmId: farm.id };
      }
    }

    const membership = await this.prisma.farmMembership.findFirst({
      where: { userId: buyerUserId },
      select: { farmId: true },
      orderBy: { createdAt: "asc" }
    });
    if (membership) {
      return {
        kind: "PLATFORM_USER_WITH_FARM",
        buyerFarmId: membership.farmId
      };
    }

    const buyerProfile = await this.prisma.buyerProfile.findUnique({
      where: { userId: buyerUserId },
      select: { userId: true }
    });
    if (buyerProfile) {
      return { kind: "PLATFORM_USER_WITHOUT_FARM", buyerFarmId: null };
    }

    return { kind: "EXTERNAL_BUYER", buyerFarmId: null };
  }
}
