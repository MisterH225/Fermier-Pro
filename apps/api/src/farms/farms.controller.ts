import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ProducerProfileGuard } from "../auth/guards/producer-profile.guard";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateFarmDto } from "./dto/create-farm.dto";
import { UpdateFarmCheptelConfigDto } from "./dto/update-farm-cheptel-config.dto";
import { TransferFarmOwnershipDto } from "./dto/transfer-farm-ownership.dto";
import { ArchiveFarmDto } from "./dto/archive-farm.dto";
import { SetActiveFarmDto } from "./dto/set-active-farm.dto";
import {
  AnimalProductionTagsService,
  type AnimalTagPrefix
} from "../livestock/animal-production-tags.service";
import { FarmsService } from "./farms.service";

const TAG_PREFIXES = new Set<AnimalTagPrefix>(["Trui", "Ver", "Eng", "Dem"]);

@Controller("farms")
@UseGuards(SupabaseJwtGuard)
export class FarmsController {
  constructor(
    private readonly farms: FarmsService,
    private readonly animalTags: AnimalProductionTagsService
  ) {}

  @Post()
  @UseGuards(ProducerProfileGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateFarmDto) {
    return this.farms.create(user, dto);
  }

  @Get()
  list(
    @CurrentUser() user: User,
    @Query("includeArchived") includeArchivedRaw?: string
  ) {
    const includeArchived = includeArchivedRaw === "true";
    return this.farms.listForUser(user, { includeArchived });
  }

  @Get("all")
  listAll(@CurrentUser() user: User) {
    return this.farms.listAllForUser(user);
  }

  @Post(":farmId/transfer-ownership")
  transferOwnership(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: TransferFarmOwnershipDto
  ) {
    return this.farms.transferOwnership(user, farmId, dto);
  }

  @Get(":farmId/audit-logs")
  @UseGuards(FarmScopesGuard)
  @RequireFarmScopes(FARM_SCOPE.auditRead)
  auditLogs(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string
  ) {
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    return this.farms.listAuditLogs(
      user,
      farmId,
      Number.isFinite(limit) ? limit : undefined,
      cursor
    );
  }

  @Put(":farmId/cheptel-config")
  @UseGuards(FarmScopesGuard)
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  updateCheptelConfig(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: UpdateFarmCheptelConfigDto
  ) {
    return this.farms.updateCheptelConfig(user, farmId, dto);
  }

  @Get(":farmId/cheptel")
  @UseGuards(FarmScopesGuard)
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  cheptelOverview(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string
  ) {
    return this.farms.getCheptelOverview(user, farmId);
  }

  @Get(":farmId/cheptel/status-logs")
  @UseGuards(FarmScopesGuard)
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  cheptelStatusLogs(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("entityType") entityType?: string,
    @Query("newStatus") newStatus?: string,
    @Query("limit") limitRaw?: string
  ) {
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    return this.farms.listCheptelStatusLogs(user, farmId, {
      from,
      to,
      entityType,
      newStatus,
      limit: Number.isFinite(limit) ? limit : undefined
    });
  }

  @Get(":farmId/next-animal-number")
  @UseGuards(FarmScopesGuard)
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  async nextAnimalNumber(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("prefix") prefixRaw?: string,
    @Query("count") countRaw?: string
  ) {
    const prefix = (prefixRaw ?? "").trim() as AnimalTagPrefix;
    if (!TAG_PREFIXES.has(prefix)) {
      throw new BadRequestException(
        "Préfixe invalide — utilisez Trui, Ver, Eng ou Dem"
      );
    }
    await this.farms.findOneForUser(user, farmId);
    const count = countRaw ? Number.parseInt(countRaw, 10) : 1;
    if (countRaw && (!Number.isFinite(count) || count < 1 || count > 200)) {
      throw new BadRequestException("count invalide (1–200)");
    }
    if (count > 1) {
      const range = await this.animalTags.previewTagCodeRange(
        farmId,
        prefix,
        count
      );
      return {
        prefix,
        productionCategory: this.animalTags.categoryForPrefix(prefix),
        ...range
      };
    }
    const tagCode = await this.animalTags.nextTagCode(farmId, prefix);
    return {
      prefix,
      tagCode,
      productionCategory: this.animalTags.categoryForPrefix(prefix)
    };
  }

  @Patch(":farmId/archive")
  archive(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: ArchiveFarmDto
  ) {
    return this.farms.archiveFarm(user, farmId, dto);
  }

  @Patch(":farmId/restore")
  restore(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string
  ) {
    return this.farms.restoreFarm(user, farmId);
  }

  @Delete(":farmId")
  delete(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.farms.deleteFarm(user, farmId);
  }

  @Get("active")
  getActiveFarm(@CurrentUser() user: User) {
    return this.farms.getActiveOrFirstFarm(user);
  }

  @Patch("active")
  setActiveFarm(@CurrentUser() user: User, @Body() dto: SetActiveFarmDto) {
    return this.farms.setActiveFarm(user, dto.farmId);
  }

  @Get(":id")
  one(@CurrentUser() user: User, @Param("id") id: string) {
    return this.farms.findOneForUser(user, id);
  }
}
