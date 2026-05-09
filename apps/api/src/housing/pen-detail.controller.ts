import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreatePenLogDto } from "./dto/create-pen-log.dto";
import { EndPenPlacementDto } from "./dto/end-pen-placement.dto";
import { StartPenPlacementDto } from "./dto/start-pen-placement.dto";
import { UpdatePenDto } from "./dto/update-pen.dto";
import { HousingService } from "./housing.service";

@Controller("farms/:farmId/pens/:penId")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class PenDetailController {
  constructor(private readonly housing: HousingService) {}

  @Get()
  @RequireFarmScopes(FARM_SCOPE.housingRead)
  detail(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("penId") penId: string
  ) {
    return this.housing.getPenDetail(user, farmId, penId);
  }

  @Patch()
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  update(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("penId") penId: string,
    @Body() dto: UpdatePenDto
  ) {
    return this.housing.updatePen(user, farmId, penId, dto);
  }

  @Delete()
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  async remove(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("penId") penId: string
  ) {
    await this.housing.deletePen(user, farmId, penId);
    return { ok: true };
  }

  @Get("placements")
  @RequireFarmScopes(FARM_SCOPE.housingRead)
  placements(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("penId") penId: string,
    @Query("activeOnly") activeOnly?: string
  ) {
    const only =
      activeOnly === "true" || activeOnly === "1";
    return this.housing.listPlacements(user, farmId, penId, only);
  }

  @Post("placements")
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  startPlacement(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("penId") penId: string,
    @Body() dto: StartPenPlacementDto
  ) {
    return this.housing.startPlacement(user, farmId, penId, dto);
  }

  @Post("placements/end")
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  endPlacement(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("penId") penId: string,
    @Body() dto: EndPenPlacementDto
  ) {
    return this.housing.endPlacement(user, farmId, penId, dto);
  }

  @Get("logs")
  @RequireFarmScopes(FARM_SCOPE.housingRead)
  logs(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("penId") penId: string
  ) {
    return this.housing.listPenLogs(user, farmId, penId);
  }

  @Post("logs")
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  createLog(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("penId") penId: string,
    @Body() dto: CreatePenLogDto
  ) {
    return this.housing.createPenLog(user, farmId, penId, dto);
  }
}
