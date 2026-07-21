import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { Profile, User } from "@prisma/client";
import {
  FarmInvitationStatus,
  MarketplaceTransactionStatus,
  MerchantOrderStatus,
  MerchantSubscriptionStatus,
  MerchantSubscriptionTier,
  OfferStatus,
  Prisma,
  ProfileModerationStatus,
  ProfileType,
  TaskStatus,
  VetAppointmentStatus,
  WithdrawalRequestStatus
} from "@prisma/client";
import { AuditService } from "../common/audit.service";
import { AUDIT_ACTION } from "../common/audit.constants";
import { ACTIVE_ESCROW_STATUSES } from "../marketplace/escrow/transaction.utils";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildDeactivationEffects,
  formatCountMessage
} from "./profile-deactivation.effects";
import {
  PROFILE_DEACTIVATION_BLOCK,
  type ProfileDeactivateResult,
  type ProfileDeactivationBlock,
  type ProfileDeactivationPreview
} from "./profile-deactivation.types";

const VET_BLOCKING_STATUSES: VetAppointmentStatus[] = [
  VetAppointmentStatus.VISIT_PROPOSED,
  VetAppointmentStatus.AWAITING_PAYMENT,
  VetAppointmentStatus.APPOINTMENT_CONFIRMED,
  VetAppointmentStatus.APPOINTMENT_IN_PROGRESS
];

const MERCHANT_OPEN_ORDER_STATUSES: MerchantOrderStatus[] = [
  MerchantOrderStatus.payment_pending,
  MerchantOrderStatus.paid,
  MerchantOrderStatus.confirmed,
  MerchantOrderStatus.shipping,
  MerchantOrderStatus.disputed
];

const MERCHANT_ACTIVE_SUB_STATUSES: MerchantSubscriptionStatus[] = [
  MerchantSubscriptionStatus.active,
  MerchantSubscriptionStatus.trialing,
  MerchantSubscriptionStatus.past_due
];

const OPEN_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.todo,
  TaskStatus.in_progress
];

const BUYER_OPEN_OFFER_STATUSES: OfferStatus[] = [
  OfferStatus.accepted,
  OfferStatus.credit_agreed,
  OfferStatus.advance_confirmed,
  OfferStatus.balance_pending,
  OfferStatus.balance_declared,
  OfferStatus.arbitration
];

const PENDING_WITHDRAWAL_STATUSES: WithdrawalRequestStatus[] = [
  WithdrawalRequestStatus.pending_review,
  WithdrawalRequestStatus.processing
];

@Injectable()
export class ProfileDeactivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async preview(
    user: User,
    profileId: string
  ): Promise<ProfileDeactivationPreview> {
    const profile = await this.requireOwnedProfile(user.id, profileId);
    const blocks = await this.collectBlocks(user.id, profile);
    return {
      profileId: profile.id,
      profileType: profile.type,
      canDeactivate: blocks.length === 0,
      blocks,
      effects: buildDeactivationEffects(profile.type)
    };
  }

  async deactivate(
    user: User,
    profileId: string,
    opts?: { reason?: string | null }
  ): Promise<ProfileDeactivateResult> {
    const profile = await this.requireOwnedProfile(user.id, profileId);
    const blocks = await this.collectBlocks(user.id, profile);
    if (blocks.length > 0) {
      throw new ConflictException({
        code: blocks[0]!.code,
        message: blocks[0]!.message,
        blocks
      });
    }

    const reason = opts?.reason?.trim() || null;
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const deactivated = await tx.profile.update({
        where: { id: profile.id },
        data: {
          profileStatus: ProfileModerationStatus.deactivated,
          deactivatedAt: now,
          deactivatedReason: reason,
          isDefault: false
        }
      });

      let suggestedActiveProfileId: string | null = null;
      if (profile.isDefault) {
        const next = await tx.profile.findFirst({
          where: {
            userId: user.id,
            id: { not: profile.id },
            profileStatus: ProfileModerationStatus.active
          },
          orderBy: { createdAt: "asc" },
          select: { id: true }
        });
        if (next) {
          await tx.profile.update({
            where: { id: next.id },
            data: { isDefault: true }
          });
          suggestedActiveProfileId = next.id;
        }
      } else {
        const currentDefault = await tx.profile.findFirst({
          where: {
            userId: user.id,
            isDefault: true,
            profileStatus: ProfileModerationStatus.active
          },
          select: { id: true }
        });
        suggestedActiveProfileId = currentDefault?.id ?? null;
      }

      if (profile.type === ProfileType.veterinarian) {
        await tx.vetProfile.updateMany({
          where: { userId: user.id },
          data: { availability: false }
        });
      }

      if (profile.type === ProfileType.producer) {
        await tx.farmInvitation.updateMany({
          where: {
            createdById: user.id,
            status: FarmInvitationStatus.pending
          },
          data: {
            status: FarmInvitationStatus.rejected,
            rejectedAt: now,
            archived: true
          }
        });
      }

      if (profile.type === ProfileType.technician) {
        await tx.technicianProfile.updateMany({
          where: { userId: user.id },
          data: { isActive: false, isPublic: false }
        });
      }

      if (profile.type === ProfileType.buyer) {
        await tx.buyerProfile.updateMany({
          where: { userId: user.id },
          data: { isActive: false }
        });
      }

      if (profile.type === ProfileType.merchant) {
        await tx.merchantProfile.updateMany({
          where: { userId: user.id },
          data: { isActive: false }
        });
      }

      return { deactivated, suggestedActiveProfileId };
    });

    await this.audit.record({
      actorUserId: user.id,
      action: AUDIT_ACTION.profileDeactivated,
      resourceType: "profile",
      resourceId: profile.id,
      metadata: {
        profileType: profile.type,
        reason,
        suggestedActiveProfileId: updated.suggestedActiveProfileId
      } as Prisma.InputJsonValue
    });

    return {
      profileId: updated.deactivated.id,
      profileStatus: "deactivated",
      deactivatedAt: (
        updated.deactivated.deactivatedAt ?? now
      ).toISOString(),
      suggestedActiveProfileId: updated.suggestedActiveProfileId
    };
  }

  async reactivate(user: User, profileId: string): Promise<Profile> {
    const profile = await this.requireOwnedProfile(user.id, profileId);

    if (
      profile.profileStatus === ProfileModerationStatus.banned ||
      profile.profileStatus === ProfileModerationStatus.suspended
    ) {
      throw new ForbiddenException({
        code: PROFILE_DEACTIVATION_BLOCK.MODERATION_SANCTION,
        message:
          "Ce profil est sous sanction de modération — la réactivation est impossible."
      });
    }

    if (profile.profileStatus !== ProfileModerationStatus.deactivated) {
      throw new ConflictException({
        code: PROFILE_DEACTIVATION_BLOCK.NOT_DEACTIVATED,
        message: "Ce profil n'est pas désactivé."
      });
    }

    const reactivated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.profile.update({
        where: { id: profile.id },
        data: {
          profileStatus: ProfileModerationStatus.active,
          deactivatedAt: null,
          deactivatedReason: null
        }
      });

      if (profile.type === ProfileType.technician) {
        await tx.technicianProfile.updateMany({
          where: { userId: user.id },
          data: { isActive: true }
        });
      }
      if (profile.type === ProfileType.buyer) {
        await tx.buyerProfile.updateMany({
          where: { userId: user.id },
          data: { isActive: true }
        });
      }
      if (profile.type === ProfileType.merchant) {
        await tx.merchantProfile.updateMany({
          where: { userId: user.id },
          data: { isActive: true }
        });
      }

      return row;
    });

    await this.audit.record({
      actorUserId: user.id,
      action: AUDIT_ACTION.profileReactivated,
      resourceType: "profile",
      resourceId: profile.id,
      metadata: { profileType: profile.type } as Prisma.InputJsonValue
    });

    return reactivated;
  }

  /** Collecte les blocages — exportée pour les tests unitaires via service. */
  async collectBlocks(
    userId: string,
    profile: Profile
  ): Promise<ProfileDeactivationBlock[]> {
    const blocks: ProfileDeactivationBlock[] = [];

    if (profile.profileStatus === ProfileModerationStatus.deactivated) {
      blocks.push({
        code: PROFILE_DEACTIVATION_BLOCK.ALREADY_DEACTIVATED,
        message: "Ce profil est déjà désactivé."
      });
      return blocks;
    }

    if (
      profile.profileStatus === ProfileModerationStatus.banned ||
      profile.profileStatus === ProfileModerationStatus.suspended
    ) {
      blocks.push({
        code: PROFILE_DEACTIVATION_BLOCK.MODERATION_SANCTION,
        message:
          "Ce profil est sous sanction de modération — désactivation volontaire impossible."
      });
      return blocks;
    }

    const activeCount = await this.prisma.profile.count({
      where: {
        userId,
        profileStatus: ProfileModerationStatus.active
      }
    });
    if (activeCount <= 1) {
      blocks.push({
        code: PROFILE_DEACTIVATION_BLOCK.LAST_ACTIVE_PROFILE,
        message:
          "C'est votre dernier profil actif. Pour quitter Fermier Pro, utilisez « Supprimer mon compte ».",
        count: activeCount
      });
    }

    if (profile.type === ProfileType.producer) {
      blocks.push(...(await this.producerBlocks(userId)));
    } else if (profile.type === ProfileType.buyer) {
      blocks.push(...(await this.buyerBlocks(userId)));
    } else if (profile.type === ProfileType.veterinarian) {
      blocks.push(...(await this.vetBlocks(userId)));
    } else if (profile.type === ProfileType.merchant) {
      blocks.push(...(await this.merchantBlocks(userId)));
    } else if (profile.type === ProfileType.technician) {
      blocks.push(...(await this.technicianBlocks(userId)));
    }

    return blocks;
  }

  private async producerBlocks(
    userId: string
  ): Promise<ProfileDeactivationBlock[]> {
    const farms = await this.prisma.farm.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true }
    });
    if (farms.length === 0) {
      return [];
    }
    const farmIds = farms.map((f) => f.id);
    const [activeAnimals, otherMembers] = await Promise.all([
      this.prisma.animal.count({
        where: { farmId: { in: farmIds }, status: "active" }
      }),
      this.prisma.farmMembership.count({
        where: {
          farmId: { in: farmIds },
          userId: { not: userId }
        }
      })
    ]);
    if (activeAnimals > 0 || otherMembers > 0) {
      const parts: string[] = [];
      if (activeAnimals > 0) {
        parts.push(
          formatCountMessage(
            activeAnimals,
            "animal actif",
            "animaux actifs",
            "sur vos fermes"
          )
        );
      }
      if (otherMembers > 0) {
        parts.push(
          formatCountMessage(
            otherMembers,
            "membre",
            "membres",
            "à retirer ou transférer"
          )
        );
      }
      return [
        {
          code: PROFILE_DEACTIVATION_BLOCK.PRODUCER_FARM_ACTIVE,
          message: `Ferme(s) encore active(s) : ${parts.join(" ; ")} — résolvez cela d'abord.`,
          count: activeAnimals + otherMembers,
          resolveHint: "farms"
        }
      ];
    }
    return [];
  }

  private async buyerBlocks(
    userId: string
  ): Promise<ProfileDeactivationBlock[]> {
    const blocks: ProfileDeactivationBlock[] = [];
    const escrowCount = await this.prisma.marketplaceTransaction.count({
      where: {
        buyerUserId: userId,
        status: {
          in: [
            ...ACTIVE_ESCROW_STATUSES,
            MarketplaceTransactionStatus.PAYMENT_PENDING,
            MarketplaceTransactionStatus.OFFER_ACCEPTED
          ]
        }
      }
    });
    const openOffers = await this.prisma.marketplaceOffer.count({
      where: {
        buyerUserId: userId,
        status: { in: BUYER_OPEN_OFFER_STATUSES }
      }
    });
    const total = escrowCount + openOffers;
    if (total > 0) {
      blocks.push({
        code: PROFILE_DEACTIVATION_BLOCK.BUYER_OPEN_TRANSACTION,
        message: formatCountMessage(
          total,
          "transaction / offre en cours",
          "transactions / offres en cours",
          "— clôturez-les d'abord"
        ),
        count: total,
        resolveHint: "marketplace/orders"
      });
    }
    return blocks;
  }

  private async vetBlocks(
    userId: string
  ): Promise<ProfileDeactivationBlock[]> {
    const blocks: ProfileDeactivationBlock[] = [];
    const apptCount = await this.prisma.vetAppointment.count({
      where: {
        vetUserId: userId,
        status: { in: VET_BLOCKING_STATUSES }
      }
    });
    if (apptCount > 0) {
      blocks.push({
        code: PROFILE_DEACTIVATION_BLOCK.VET_OPEN_APPOINTMENT,
        message: formatCountMessage(
          apptCount,
          "rendez-vous en cours",
          "rendez-vous en cours",
          "— clôturez-les d'abord"
        ),
        count: apptCount,
        resolveHint: "vet/agenda"
      });
    }
    const withdrawals = await this.prisma.withdrawalRequest.count({
      where: {
        userId,
        status: { in: PENDING_WITHDRAWAL_STATUSES }
      }
    });
    if (withdrawals > 0) {
      blocks.push({
        code: PROFILE_DEACTIVATION_BLOCK.VET_PENDING_WITHDRAWAL,
        message: formatCountMessage(
          withdrawals,
          "retrait de gains en attente",
          "retraits de gains en attente",
          "— attendez leur traitement"
        ),
        count: withdrawals,
        resolveHint: "wallet/withdrawals"
      });
    }
    return blocks;
  }

  private async merchantBlocks(
    userId: string
  ): Promise<ProfileDeactivationBlock[]> {
    const blocks: ProfileDeactivationBlock[] = [];
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true
      }
    });
    if (
      merchant?.subscriptionTier === MerchantSubscriptionTier.premium &&
      merchant.subscriptionStatus != null &&
      MERCHANT_ACTIVE_SUB_STATUSES.includes(merchant.subscriptionStatus)
    ) {
      blocks.push({
        code: PROFILE_DEACTIVATION_BLOCK.MERCHANT_ACTIVE_SUBSCRIPTION,
        message:
          "Abonnement premium commerçant encore actif — résiliez-le d'abord.",
        resolveHint: "merchant/subscription"
      });
    }
    const openOrders = await this.prisma.merchantOrder.count({
      where: {
        sellerUserId: userId,
        status: { in: MERCHANT_OPEN_ORDER_STATUSES }
      }
    });
    if (openOrders > 0) {
      blocks.push({
        code: PROFILE_DEACTIVATION_BLOCK.MERCHANT_OPEN_ORDER,
        message: formatCountMessage(
          openOrders,
          "commande boutique en cours",
          "commandes boutique en cours",
          "— clôturez-les d'abord"
        ),
        count: openOrders,
        resolveHint: "merchant/orders"
      });
    }
    return blocks;
  }

  private async technicianBlocks(
    userId: string
  ): Promise<ProfileDeactivationBlock[]> {
    const openTasks = await this.prisma.farmTask.count({
      where: {
        assignedUserId: userId,
        status: { in: OPEN_TASK_STATUSES }
      }
    });
    if (openTasks > 0) {
      return [
        {
          code: PROFILE_DEACTIVATION_BLOCK.TECHNICIAN_OPEN_TASK,
          message: formatCountMessage(
            openTasks,
            "tâche assignée en cours",
            "tâches assignées en cours",
            "— terminez-les ou faites-vous désassigner"
          ),
          count: openTasks,
          resolveHint: "tech/tasks"
        }
      ];
    }
    return [];
  }

  private async requireOwnedProfile(
    userId: string,
    profileId: string
  ): Promise<Profile> {
    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, userId }
    });
    if (!profile) {
      throw new NotFoundException("Profil introuvable");
    }
    return profile;
  }
}
