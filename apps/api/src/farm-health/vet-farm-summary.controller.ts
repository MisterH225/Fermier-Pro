import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { VetFarmSummaryService } from "./vet-farm-summary.service";

@Controller("farms/:farmId")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class VetFarmSummaryController {
  constructor(private readonly summary: VetFarmSummaryService) {}

  /**
   * Agrégat dossier élevage vétérinaire — un seul appel :
   * santé, timeline, mortalité 6 mois, GMQ 8 sem., lots, repro, biosécurité, lectures.
   */
  @Get("vet-summary")
  @RequireFarmScopes(
    FARM_SCOPE.healthRead,
    FARM_SCOPE.livestockRead,
    FARM_SCOPE.vetRead
  )
  getSummary(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.summary.getSummary(user, farmId);
  }
}
