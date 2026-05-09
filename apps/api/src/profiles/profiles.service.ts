import {
  ConflictException,
  ForbiddenException,
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
      const profile = await this.prisma.profile.create({
        data: {
          userId: user.id,
          type: dto.type,
          displayName: dto.displayName
        }
      });
      if (dto.type === ProfileType.producer) {
        await this.ensureBuyerProfileForProducer(user.id);
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
          : {})
      }
    });
  }

  async remove(user: User, profileId: string): Promise<void> {
    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, userId: user.id }
    });
    if (!profile) {
      throw new NotFoundException("Profil introuvable");
    }
    if (profile.type === "buyer" && profile.isDefault) {
      throw new ForbiddenException(
        "Impossible de supprimer le profil acheteur par defaut"
      );
    }
    await this.prisma.profile.delete({ where: { id: profileId } });
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
