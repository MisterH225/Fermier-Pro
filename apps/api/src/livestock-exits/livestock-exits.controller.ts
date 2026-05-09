import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { LivestockExitKind } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateLivestockExitDto } from "./dto/create-livestock-exit.dto";
import { LivestockExitsService } from "./livestock-exits.service";

function parseQueryDate(label: string, value?: string): Date | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Parametre ${label} invalide`);
  }
  return d;
}

@Controller("farms/:farmId/exits")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class LivestockExitsController {
  constructor(private readonly exits: LivestockExitsService) {}

  @Get()
  @RequireFarmScopes(FARM_SCOPE.exitsRead)
  list(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("kind") kindRaw?: string,
    @Query("from") fromRaw?: string,
    @Query("to") toRaw?: string
  ) {
    const kind =
      kindRaw &&
      Object.values(LivestockExitKind).includes(kindRaw as LivestockExitKind)
        ? (kindRaw as LivestockExitKind)
        : undefined;
    return this.exits.list(user, farmId, {
      kind,
      from: parseQueryDate("from", fromRaw),
      to: parseQueryDate("to", toRaw)
    });
  }

  @Post()
  @RequireFarmScopes(FARM_SCOPE.exitsWrite)
  create(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateLivestockExitDto
  ) {
    return this.exits.create(user, farmId, dto);
  }

  @Get(":id")
  @RequireFarmScopes(FARM_SCOPE.exitsRead)
  one(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("id") id: string
  ) {
    return this.exits.getOne(user, farmId, id);
  }
}
