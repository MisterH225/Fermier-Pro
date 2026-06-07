import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { PatchFarmSettingsDto } from "./dto/patch-farm-settings.dto";
import { FarmSettingsService } from "./farm-settings.service";

@Controller("farms/:farmId/settings")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class FarmSettingsController {
  constructor(private readonly settings: FarmSettingsService) {}

  @Get()
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  getAll(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.settings.getAll(user, farmId);
  }

  @Patch()
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  patch(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: PatchFarmSettingsDto
  ) {
    return this.settings.patch(user, farmId, dto);
  }

  @Patch("currency")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  patchCurrency(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() body: { currencyCode: string; currencySymbol: string }
  ) {
    return this.settings.patchCurrency(
      user,
      farmId,
      body.currencyCode,
      body.currencySymbol
    );
  }

  @Patch("language")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  patchLanguage(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() body: { language: "fr" | "en" }
  ) {
    return this.settings.patchLanguage(user, farmId, body.language);
  }

  @Patch("notifications")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  patchNotifications(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body()
    body: {
      push?: PatchFarmSettingsDto["alerts"];
      extra?: Record<string, unknown>;
    }
  ) {
    return this.settings.patchNotifications(user, farmId, body);
  }
}
