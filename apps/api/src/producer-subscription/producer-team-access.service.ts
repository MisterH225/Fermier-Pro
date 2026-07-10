import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  FarmInvitationStatus,
  MembershipRole,
  MerchantSubscriptionStatus,
  MerchantSubscriptionTier,
  type ProducerProfile
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export const PRODUCER_TEAM_PREMIUM_REQUIRED =
  "Abonnement Premium producteur requis pour gérer l'équipe de votre projet.";

@Injectable()
export class ProducerTeamAccessService {
  constructor(private readonly prisma: PrismaService) {}

  isPremiumActive(profile: Pick<ProducerProfile, "subscriptionTier" | "subscriptionStatus">): boolean {
    if (profile.subscriptionTier !== MerchantSubscriptionTier.premium) {
      return false;
    }
    const status = profile.subscriptionStatus;
    return (
      status === MerchantSubscriptionStatus.active ||
      status === MerchantSubscriptionStatus.trialing
    );
  }

  async requirePremiumOwnerForFarm(farmId: string): Promise<void> {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: {
        ownerId: true,
        owner: {
          select: {
            producerProfile: {
              select: { subscriptionTier: true, subscriptionStatus: true }
            }
          }
        }
      }
    });
    if (!farm?.owner.producerProfile) {
      throw new ForbiddenException(PRODUCER_TEAM_PREMIUM_REQUIRED);
    }
    if (!this.isPremiumActive(farm.owner.producerProfile)) {
      throw new ForbiddenException(PRODUCER_TEAM_PREMIUM_REQUIRED);
    }
  }

  async requirePremiumOwner(userId: string): Promise<void> {
    const profile = await this.prisma.producerProfile.findUnique({
      where: { userId },
      select: { subscriptionTier: true, subscriptionStatus: true }
    });
    if (!profile || !this.isPremiumActive(profile)) {
      throw new ForbiddenException(PRODUCER_TEAM_PREMIUM_REQUIRED);
    }
  }

  async revokeTeamAccessForOwner(userId: string): Promise<void> {
    const ownedFarms = await this.prisma.farm.findMany({
      where: { ownerId: userId },
      select: { id: true }
    });
    const farmIds = ownedFarms.map((f) => f.id);
    if (farmIds.length === 0) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.farmMembership.deleteMany({
        where: {
          farmId: { in: farmIds },
          role: { not: MembershipRole.owner }
        }
      }),
      this.prisma.farmInvitation.updateMany({
        where: {
          farmId: { in: farmIds },
          status: {
            in: [
              FarmInvitationStatus.pending,
              FarmInvitationStatus.accepted
            ]
          }
        },
        data: { status: FarmInvitationStatus.expired }
      })
    ]);
  }
}
