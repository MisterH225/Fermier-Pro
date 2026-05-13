import {
  Body,
  Controller,
  Get,
  Param,
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

  @Get(":id")
  one(@CurrentUser() user: User, @Param("id") id: string) {
    return this.farms.findOneForUser(user, id);
  }
}
