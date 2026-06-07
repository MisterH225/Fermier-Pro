import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { GestationStatus } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateGestationDto } from "./dto/create-gestation.dto";
import { UpdateGestationDto } from "./dto/update-gestation.dto";
import { PatchGestationStatusDto } from "./dto/patch-gestation-status.dto";
import { RecordLitterDto } from "./dto/record-litter.dto";
import { UpdateGestationSettingsDto } from "./dto/update-gestation-settings.dto";
import { GestationService } from "./gestation.service";
import { RequirePlatformModule } from "../feature-flags/require-platform-module.decorator";
import { PlatformModuleEnabledGuard } from "../feature-flags/platform-module-enabled.guard";

@Controller("farms/:farmId/gestation")
@RequirePlatformModule("gestation")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard, PlatformModuleEnabledGuard)
export class GestationController {
  constructor(private readonly gestation: GestationService) {}

  @Get("overview")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  overview(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.gestation.getOverview(user, farmId);
  }

  @Get("available-sows")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  availableSows(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string
  ) {
    return this.gestation.listAvailableSows(user, farmId);
  }

  @Get("ai-mating-plan")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  aiMatingPlan(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.gestation.getAiMatingPlan(user, farmId);
  }

  @Get("history")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  history(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("filter") filter?: string
  ) {
    return this.gestation.getHistory(user, farmId, filter);
  }

  @Get("stats")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  stats(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.gestation.getStats(user, farmId);
  }

  @Get("settings")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  getSettings(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.gestation.getSettings(user, farmId);
  }

  @Put("settings")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  updateSettings(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: UpdateGestationSettingsDto
  ) {
    return this.gestation.updateSettings(user, farmId, dto);
  }

  @Get("gestations")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  list(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("status") status?: GestationStatus,
    @Query("filter") filter?: string,
    @Query("q") q?: string
  ) {
    return this.gestation.list(user, farmId, { status, filter, q });
  }

  @Post("gestations")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  create(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateGestationDto
  ) {
    return this.gestation.create(user, { ...dto, farmId });
  }

  @Get("gestations/:gestationId")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  getOne(
    @CurrentUser() user: User,
    @Param("gestationId") gestationId: string
  ) {
    return this.gestation.getOne(user, gestationId);
  }

  @Put("gestations/:gestationId")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  update(
    @CurrentUser() user: User,
    @Param("gestationId") gestationId: string,
    @Body() dto: UpdateGestationDto
  ) {
    return this.gestation.update(user, gestationId, dto);
  }

  @Patch("gestations/:gestationId/status")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  patchStatus(
    @CurrentUser() user: User,
    @Param("gestationId") gestationId: string,
    @Body() dto: PatchGestationStatusDto
  ) {
    return this.gestation.patchStatus(user, gestationId, dto);
  }

  @Post("gestations/:gestationId/litter")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  recordLitter(
    @CurrentUser() user: User,
    @Param("gestationId") gestationId: string,
    @Body() dto: RecordLitterDto
  ) {
    return this.gestation.recordLitter(user, gestationId, dto);
  }

  @Patch("vaccines/:vaccineId/administer")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  administerVaccine(
    @CurrentUser() user: User,
    @Param("vaccineId") vaccineId: string
  ) {
    return this.gestation.administerVaccine(user, vaccineId);
  }

  @Patch("checklist/:itemId")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  toggleChecklist(
    @CurrentUser() user: User,
    @Param("itemId") itemId: string,
    @Body() body: { isChecked: boolean }
  ) {
    return this.gestation.toggleChecklist(user, itemId, body.isChecked === true);
  }
}
