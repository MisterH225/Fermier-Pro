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
import { AnimalProductionTagsService } from "../livestock/animal-production-tags.service";
import { CompleteOnboardingDto } from "./dto/complete-onboarding.dto";
import {
  barnCodeForIndex,
  barnLabelForIndex,
  buildDefaultPlacementPlan,
  persistOnboardingPlacementPlan,
  penCategoryForOnboardingRole,
  penNameForBarn,
  type CreatedPenMeta
} from "./onboarding-pen-layout";

const PORCIN_CODE = "porcin";

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitations: InvitationsService,
    private readonly taxonomy: TaxonomyService,
    private readonly animalTags: AnimalProductionTagsService
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

      const truiTags = await this.animalTags.allocateTagCodes(
        createdFarm.id,
        "Trui",
        dto.femaleBreeders,
        tx
      );
      const verTags = await this.animalTags.allocateTagCodes(
        createdFarm.id,
        "Ver",
        dto.maleBreeders,
        tx
      );
      const engTags = await this.animalTags.allocateTagCodes(
        createdFarm.id,
        "Eng",
        dto.fatteningHeadcount,
        tx
      );
      const demTags = await this.animalTags.allocateTagCodes(
        createdFarm.id,
        "Dem",
        dto.starterHeadcount,
        tx
      );

      const femaleIds: string[] = [];
      const maleIds: string[] = [];
      const fatteningIds: string[] = [];
      const starterIds: string[] = [];

      for (const tagCode of truiTags) {
        const a = await tx.animal.create({
          data: {
            farmId: createdFarm.id,
            speciesId: species.id,
            sex: "female",
            status: "active",
            tagCode,
            productionCategory: "breeding_female",
            notes: "Truie reproductrice — onboarding"
          }
        });
        femaleIds.push(a.id);
      }
      for (const tagCode of verTags) {
        const a = await tx.animal.create({
          data: {
            farmId: createdFarm.id,
            speciesId: species.id,
            sex: "male",
            status: "active",
            tagCode,
            productionCategory: "breeding_male",
            notes: "Verrat — onboarding"
          }
        });
        maleIds.push(a.id);
      }
      for (const tagCode of engTags) {
        const a = await tx.animal.create({
          data: {
            farmId: createdFarm.id,
            speciesId: species.id,
            sex: "unknown",
            status: "active",
            tagCode,
            productionCategory: "fattening",
            notes: "Engraissement — onboarding"
          }
        });
        fatteningIds.push(a.id);
      }
      for (const tagCode of demTags) {
        const a = await tx.animal.create({
          data: {
            farmId: createdFarm.id,
            speciesId: species.id,
            sex: "unknown",
            status: "active",
            tagCode,
            productionCategory: "starter",
            notes: "Démarrage — onboarding"
          }
        });
        starterIds.push(a.id);
      }

      const createdPens: Array<CreatedPenMeta & { capacity: number }> = [];

      for (let b = 0; b < dto.buildingsCount; b += 1) {
        const code = barnCodeForIndex(b);
        const barn = await tx.barn.create({
          data: {
            farmId: createdFarm.id,
            name: barnLabelForIndex(b),
            code,
            sortOrder: b
          }
        });
        for (let p = 0; p < dto.pensPerBuilding; p += 1) {
          const category =
            b === 0 && p === 0
              ? penCategoryForOnboardingRole("maternity")
              : penCategoryForOnboardingRole("default");
          const penLabel = penNameForBarn(code, p);
          const pen = await tx.pen.create({
            data: {
              barnId: barn.id,
              name: penLabel,
              code: penLabel,
              capacity: dto.maxPigsPerPen,
              sortOrder: p,
              category,
              categoryForced: b === 0 && p === 0
            }
          });
          createdPens.push({
            id: pen.id,
            barnIndex: b,
            sortOrder: p,
            code,
            capacity: dto.maxPigsPerPen
          });
        }
      }

      const pensByBarn: Array<
        Array<{ id: string; capacity: number; occupancy: number }>
      > = Array.from({ length: dto.buildingsCount }, () => []);
      for (const pen of createdPens) {
        pensByBarn[pen.barnIndex].push({
          id: pen.id,
          capacity: pen.capacity,
          occupancy: 0
        });
      }

      const plan = buildDefaultPlacementPlan({
        pensByBarn,
        femaleIds,
        maleIds,
        fatteningIds,
        starterIds
      });

      await persistOnboardingPlacementPlan(tx, {
        farmId: createdFarm.id,
        userId: user.id,
        plan,
        femaleIds,
        maleIds,
        fatteningIds,
        starterIds,
        speciesId: species.id
      });

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
