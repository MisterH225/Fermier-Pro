import {
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
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { PatchAnimalStatusDto } from "../livestock/dto/patch-animal-status.dto";
import { PatchAnimalStatusExtendedDto } from "./dto/patch-animal-status-extended.dto";
import { SellAnimalDto } from "./dto/sell-animal.dto";
import { PatchPenAveragesDto } from "./dto/patch-pen-averages.dto";
import { ConfirmDetectedBatchDto } from "./dto/confirm-detected-batch.dto";
import { UpsertGmqSettingsDto } from "./dto/upsert-gmq-settings.dto";
import { CheptelService } from "./cheptel.service";
import { HousingService } from "../housing/housing.service";

@Controller("farms/:farmId/cheptel")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class CheptelController {
  constructor(
    private readonly cheptel: CheptelService,
    private readonly housing: HousingService
  ) {}

  @Post("apply-default-layout")
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  applyDefaultLayout(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string
  ) {
    return this.cheptel.applyDefaultPenLayout(user, farmId);
  }

  @Post("fix-pen-allocation")
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  fixPenAllocation(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string
  ) {
    return this.cheptel.fixPenAllocation(user, farmId);
  }

  @Get("pens")
  @RequireFarmScopes(FARM_SCOPE.housingRead)
  listPens(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("barnId") barnId?: string
  ) {
    return this.cheptel.listPens(user, farmId, barnId);
  }

  @Get("pens/:penId/animals")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  penAnimals(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("penId") penId: string
  ) {
    return this.cheptel.listPenContents(user, farmId, penId);
  }

  @Get("pens/:penId/vaccine-alerts")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  penVaccineAlerts(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("penId") penId: string
  ) {
    return this.cheptel.getPenVaccineAlerts(user, farmId, penId);
  }

  @Patch("pens/:penId/toggle-active")
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  togglePenActive(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("penId") penId: string
  ) {
    return this.cheptel.togglePenActive(user, farmId, penId);
  }

  @Patch("pens/:penId/averages")
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  patchPenAverages(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("penId") penId: string,
    @Body() dto: PatchPenAveragesDto
  ) {
    return this.cheptel.patchPenAverages(user, farmId, penId, dto);
  }

  @Delete("pens/:penId")
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  async deletePen(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("penId") penId: string
  ) {
    await this.housing.deletePen(user, farmId, penId);
    return { ok: true };
  }

  @Get("history")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  history(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("type") type?: string,
    @Query("limit") limitRaw?: string
  ) {
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    return this.cheptel.listHistory(user, farmId, {
      type,
      limit: Number.isFinite(limit) ? limit : undefined
    });
  }

  @Get("gmq/summary")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  gmqSummary(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.cheptel.getGmqSummary(user, farmId);
  }

  @Get("detected-batches")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  detectedBatches(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.cheptel.detectPotentialBatches(user, farmId);
  }

  @Post("detected-batches/confirm")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  confirmDetectedBatch(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: ConfirmDetectedBatchDto
  ) {
    return this.cheptel.confirmDetectedBatch(user, farmId, dto);
  }

  @Get("gmq/settings")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  gmqSettings(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.cheptel.getGmqSettings(user, farmId);
  }

  @Put("gmq/settings")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  upsertGmqSettings(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: UpsertGmqSettingsDto
  ) {
    return this.cheptel.upsertGmqSettings(user, farmId, dto);
  }

  @Get("weight-series")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  weightSeries(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("animalId") animalId?: string,
    @Query("months") monthsRaw?: string
  ) {
    const months = monthsRaw ? Number.parseInt(monthsRaw, 10) : undefined;
    return this.cheptel.getWeightSeries(user, farmId, {
      animalId,
      months: Number.isFinite(months) ? months : undefined
    });
  }

  @Patch("animals/:animalId/status")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  patchAnimalStatus(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("animalId") animalId: string,
    @Body() dto: PatchAnimalStatusExtendedDto
  ) {
    const base: PatchAnimalStatusDto = {
      status: dto.status,
      note: dto.note
    };
    return this.cheptel.patchAnimalStatusWithLinks(user, farmId, animalId, {
      ...base,
      salePrice: dto.salePrice,
      buyerName: dto.buyerName,
      deathCause: dto.deathCause
    });
  }

  @Patch("animals/:animalId/sell")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  sellAnimal(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("animalId") animalId: string,
    @Body() dto: SellAnimalDto
  ) {
    return this.cheptel.sellAnimal(user, farmId, animalId, dto);
  }
}
