import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreatePenDto } from "./dto/create-pen.dto";
import { UpdatePenDto } from "./dto/update-pen.dto";
import { HousingService } from "./housing.service";

@Controller("farms/:farmId/barns/:barnId/pens")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class PensController {
  constructor(private readonly housing: HousingService) {}

  @Get()
  @RequireFarmScopes(FARM_SCOPE.housingRead)
  list(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("barnId") barnId: string
  ) {
    return this.housing.listPens(user, farmId, barnId);
  }

  @Post()
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  create(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("barnId") barnId: string,
    @Body() dto: CreatePenDto
  ) {
    return this.housing.createPen(user, farmId, barnId, dto);
  }
}
