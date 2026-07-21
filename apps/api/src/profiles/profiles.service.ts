import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { Profile, User } from "@prisma/client";
import { Prisma, ProfileType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: User, dto: CreateProfileDto): Promise<Profile> {
    try {
      const existingCount = await this.prisma.profile.count({
        where: { userId: user.id }
      });
      const isFirstProfile = existingCount === 0;

      const profile = await this.prisma.profile.create({
        data: {
          userId: user.id,
          type: dto.type,
          displayName: dto.displayName,
          ...(isFirstProfile ? { isDefault: true } : {})
        }
      });
      if (dto.type === ProfileType.producer) {
        await this.ensureBuyerProfileForProducer(user.id);
      }
      if (dto.type === ProfileType.technician) {
        await this.prisma.technicianProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id },
          update: {}
        });
      }
      if (dto.type === ProfileType.buyer) {
        await this.prisma.buyerProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id },
          update: {}
        });
      }
      if (dto.type === ProfileType.merchant) {
        await this.prisma.merchantProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id },
          update: {}
        });
      }
      return profile;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException(
          "Un profil de ce type existe deja pour cet utilisateur"
        );
      }
      throw e;
    }
  }

  async update(
    user: User,
    profileId: string,
    dto: UpdateProfileDto
  ): Promise<Profile> {
    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, userId: user.id }
    });
    if (!profile) {
      throw new NotFoundException("Profil introuvable");
    }

    if (dto.isDefault === true) {
      await this.prisma.$transaction([
        this.prisma.profile.updateMany({
          where: { userId: user.id },
          data: { isDefault: false }
        }),
        this.prisma.profile.update({
          where: { id: profileId },
          data: {
            displayName:
              dto.displayName !== undefined
                ? dto.displayName
                : profile.displayName,
            ...(dto.avatarUrl !== undefined
              ? { avatarUrl: dto.avatarUrl }
              : {}),
            isDefault: true
          }
        })
      ]);
      return this.prisma.profile.findUniqueOrThrow({
        where: { id: profileId }
      });
    }

    return this.prisma.profile.update({
      where: { id: profileId },
      data: {
        ...(dto.displayName !== undefined
          ? { displayName: dto.displayName }
          : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {})
      }
    });
  }

  /**
   * Ancien DELETE destructif — neutralisé.
   * Ne fait plus jamais de hard delete (données orphelines VetProfile, historique).
   * Utiliser POST /profiles/:id/deactivate (désactivation).
   * @deprecated Prefer ProfilesService.deactivate
   */
  async remove(user: User, profileId: string): Promise<never> {
    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, userId: user.id },
      select: { id: true }
    });
    if (!profile) {
      throw new NotFoundException("Profil introuvable");
    }
    throw new GoneException({
      code: "PROFILE_DELETE_GONE",
      message:
        "La suppression de profil n'est plus disponible. Utilisez la désactivation (POST /profiles/:id/deactivate).",
      deactivatePath: `/profiles/${profileId}/deactivate`
    });
  }

  /**
   * Regle produit : un producteur est aussi acheteur (marketplace : reproducteurs, porcelets, etc.).
   */
  private async ensureBuyerProfileForProducer(userId: string): Promise<void> {
    const buyer = await this.prisma.profile.findFirst({
      where: { userId, type: ProfileType.buyer }
    });
    if (buyer) {
      return;
    }
    await this.prisma.profile.create({
      data: {
        userId,
        type: ProfileType.buyer,
        isDefault: false
      }
    });
  }
}
