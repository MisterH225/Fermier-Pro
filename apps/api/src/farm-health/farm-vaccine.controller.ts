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
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateCustomVaccineDto } from "./dto/create-custom-vaccine.dto";
import { CreateVaccineRecordsDto } from "./dto/create-vaccine-records.dto";
import {
  FarmVaccineService,
  type VaccineSubjectStatus
} from "./farm-vaccine.service";

@Controller("farms/:farmId/vaccines")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class FarmVaccineController {
  constructor(private readonly vaccines: FarmVaccineService) {}

  @Get("catalog")
  @RequireFarmScopes(FARM_SCOPE.healthRead)
  catalog(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.vaccines.listCatalog(user, farmId);
  }

  @Get("coverage")
  @RequireFarmScopes(FARM_SCOPE.healthRead)
  coverage(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.vaccines.getCoverage(user, farmId);
  }

  @Get(":vaccineId/subjects")
  @RequireFarmScopes(FARM_SCOPE.healthRead)
  subjects(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("vaccineId") vaccineId: string,
    @Query("status") status?: string
  ) {
    const allowed: VaccineSubjectStatus[] = [
      "unvaccinated",
      "vaccinated",
      "upcoming"
    ];
    const filter = allowed.includes(status as VaccineSubjectStatus)
      ? (status as VaccineSubjectStatus)
      : "unvaccinated";
    return this.vaccines.listSubjects(user, farmId, vaccineId, filter);
  }

  @Post("records")
  @RequireFarmScopes(FARM_SCOPE.healthWrite)
  createRecords(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateVaccineRecordsDto
  ) {
    return this.vaccines.createRecords(user, farmId, dto);
  }

  @Post("custom")
  @RequireFarmScopes(FARM_SCOPE.healthWrite)
  createCustom(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateCustomVaccineDto
  ) {
    return this.vaccines.createCustomVaccine(user, farmId, dto);
  }
}
