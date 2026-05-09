import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateHealthEventDto } from "./dto/create-health-event.dto";
import { HealthEventsService } from "./health-events.service";

@Controller("farms/:farmId/animals/:animalId/health-events")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class HealthEventsController {
  constructor(private readonly health: HealthEventsService) {}

  @Get()
  @RequireFarmScopes(FARM_SCOPE.healthRead)
  list(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("animalId") animalId: string
  ) {
    return this.health.list(user, farmId, animalId);
  }

  @Post()
  @RequireFarmScopes(FARM_SCOPE.healthWrite)
  create(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("animalId") animalId: string,
    @Body() dto: CreateHealthEventDto
  ) {
    return this.health.create(user, farmId, animalId, dto);
  }
}
