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
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateBarnDto } from "./dto/create-barn.dto";
import { UpdateBarnDto } from "./dto/update-barn.dto";
import { HousingService } from "./housing.service";

@Controller("farms/:farmId/barns")
@RequireFeature("housing")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard, FarmScopesGuard)
export class BarnsController {
  constructor(private readonly housing: HousingService) {}

  @Get()
  @RequireFarmScopes(FARM_SCOPE.housingRead)
  list(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.housing.listBarns(user, farmId);
  }

  @Post()
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  create(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateBarnDto
  ) {
    return this.housing.createBarn(user, farmId, dto);
  }

  @Get(":barnId")
  @RequireFarmScopes(FARM_SCOPE.housingRead)
  one(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("barnId") barnId: string
  ) {
    return this.housing.getBarn(user, farmId, barnId);
  }

  @Patch(":barnId")
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  update(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("barnId") barnId: string,
    @Body() dto: UpdateBarnDto
  ) {
    return this.housing.updateBarn(user, farmId, barnId, dto);
  }

  @Delete(":barnId")
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  async remove(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("barnId") barnId: string
  ) {
    await this.housing.deleteBarn(user, farmId, barnId);
    return { ok: true };
  }
}
