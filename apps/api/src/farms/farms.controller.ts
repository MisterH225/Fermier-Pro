import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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
import { FarmsService } from "./farms.service";

@Controller("farms")
@UseGuards(SupabaseJwtGuard)
export class FarmsController {
  constructor(private readonly farms: FarmsService) {}

  @Post()
  @UseGuards(ProducerProfileGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateFarmDto) {
    return this.farms.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: User) {
    return this.farms.listForUser(user);
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

  @Get(":id")
  one(@CurrentUser() user: User, @Param("id") id: string) {
    return this.farms.findOneForUser(user, id);
  }
}
