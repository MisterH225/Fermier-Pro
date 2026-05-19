import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { FarmLivestockMode, MembershipRole, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { InvitationsService } from "../invitations/invitations.service";
import { ensureFarmFinanceBootstrap } from "../finance/finance-bootstrap";
import { TaxonomyService } from "../livestock/taxonomy.service";
import { CompleteOnboardingDto } from "./dto/complete-onboarding.dto";

const PORCIN_CODE = "porcin";

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitations: InvitationsService,
    private readonly taxonomy: TaxonomyService
  ) {}

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Utilisateur introuvable");
    }
    return {
      isOnboarded: user.isOnboarded,
      onboardingSkipped: user.onboardingSkipped
    };
  }

  async skip(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Utilisateur introuvable");
    }
    if (user.isOnboarded) {
      return this.getStatus(userId);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingSkipped: true }
    });
    return this.getStatus(userId);
  }

  async complete(user: User, dto: CompleteOnboardingDto) {
    if (user.isOnboarded) {
      throw new BadRequestException("Onboarding deja termine");
    }

    const existingOwned = await this.prisma.farm.count({
      where: { ownerId: user.id }
    });
    if (existingOwned > 0) {
      throw new BadRequestException(
        "Une ferme existe deja sur ce compte. Completez depuis les parametres ou contactez le support."
      );
    }

    if (dto.locationSource === "manual" && !dto.locationLabel?.trim()) {
      throw new BadRequestException("Indiquez une localisation manuelle");
    }
    if (
      dto.locationSource === "gps" &&
      (dto.latitude == null || dto.longitude == null)
    ) {
      throw new BadRequestException("Coordonnees GPS requises");
    }

    await this.taxonomy.ensurePorcinSpecies();
    const species = await this.prisma.species.findUnique({
      where: { code: PORCIN_CODE }
    });
    if (!species) {
      throw new BadRequestException("Espece porcin indisponible");
    }

    const farm = await this.prisma.$transaction(async (tx) => {
      const createdFarm = await tx.farm.create({
        data: {
          ownerId: user.id,
          name: dto.farmName.trim(),
          speciesFocus: dto.speciesFocus ?? PORCIN_CODE,
          livestockMode: FarmLivestockMode.hybrid,
          housingBuildingsCount: dto.buildingsCount,
          housingPensPerBuilding: dto.pensPerBuilding,
          housingMaxPigsPerPen: dto.maxPigsPerPen,
          latitude:
            dto.latitude != null
              ? new Prisma.Decimal(dto.latitude)
              : undefined,
          longitude:
            dto.longitude != null
              ? new Prisma.Decimal(dto.longitude)
              : undefined,
          address:
            dto.locationSource === "manual"
              ? dto.locationLabel?.trim()
              : dto.locationLabel?.trim() ?? undefined
        }
      });

      await tx.farmMembership.create({
        data: {
          farmId: createdFarm.id,
          userId: user.id,
          role: MembershipRole.owner,
          scopes: []
        }
      });

      await this.invitations.createDefaultInvitation(
        tx,
        createdFarm.id,
        user.id
      );

      const animalRows: Prisma.AnimalCreateManyInput[] = [];
      for (let i = 0; i < dto.femaleBreeders; i += 1) {
        animalRows.push({
          farmId: createdFarm.id,
          speciesId: species.id,
          sex: "female",
          status: "active",
          notes: "Reproductrice — onboarding"
        });
      }
      for (let i = 0; i < dto.maleBreeders; i += 1) {
        animalRows.push({
          farmId: createdFarm.id,
          speciesId: species.id,
          sex: "male",
          status: "active",
          notes: "Reproducteur — onboarding"
        });
      }
      if (animalRows.length > 0) {
        await tx.animal.createMany({ data: animalRows });
      }

      if (dto.starterHeadcount > 0) {
        await tx.livestockBatch.create({
          data: {
            farmId: createdFarm.id,
            speciesId: species.id,
            name: "Démarrage",
            categoryKey: "nursery",
            headcount: dto.starterHeadcount,
            status: "active",
            notes: "Lot créé à l'onboarding"
          }
        });
      }

      if (dto.fatteningHeadcount > 0) {
        await tx.livestockBatch.create({
          data: {
            farmId: createdFarm.id,
            speciesId: species.id,
            name: "Engraissement",
            categoryKey: "finisher",
            headcount: dto.fatteningHeadcount,
            status: "active",
            notes: "Lot créé à l'onboarding"
          }
        });
      }

      for (let b = 0; b < dto.buildingsCount; b += 1) {
        const barn = await tx.barn.create({
          data: {
            farmId: createdFarm.id,
            name: `Bâtiment ${b + 1}`,
            sortOrder: b
          }
        });
        for (let p = 0; p < dto.pensPerBuilding; p += 1) {
          await tx.pen.create({
            data: {
              barnId: barn.id,
              name: `Loge ${p + 1}`,
              capacity: dto.maxPigsPerPen,
              sortOrder: p
            }
          });
        }
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          isOnboarded: true,
          onboardingSkipped: false,
          producerHomeFarmName: dto.farmName.trim(),
          homeLocationLabel: dto.locationLabel?.trim() ?? null,
          homeLocationSource: dto.locationSource,
          homeLatitude:
            dto.latitude != null
              ? new Prisma.Decimal(dto.latitude)
              : null,
          homeLongitude:
            dto.longitude != null
              ? new Prisma.Decimal(dto.longitude)
              : null
        }
      });

      return createdFarm;
    });

    await ensureFarmFinanceBootstrap(this.prisma, farm.id);

    return {
      farm: { id: farm.id, name: farm.name },
      ...(await this.getStatus(user.id))
    };
  }
}
