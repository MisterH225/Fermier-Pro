import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { User } from "@prisma/client";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import {
  DisablePlatformModuleDto,
  ReactivatePlatformModuleDto
} from "./dto/platform-feature-flags.dto";
import {
  isPlatformModuleId,
  type PlatformModuleId
} from "./platform-modules.constants";
import { PlatformFeatureFlagsService } from "./platform-feature-flags.service";

@Controller("admin/feature-flags")
@UseGuards(SupabaseJwtGuard, SuperAdminGuard)
export class AdminFeatureFlagsController {
  constructor(private readonly flags: PlatformFeatureFlagsService) {}

  @Get()
  list() {
    return this.flags.listAdminModules();
  }

  @Get(":moduleId/history")
  history(@Param("moduleId") moduleId: string) {
    return this.flags.listHistory(this.parseModuleId(moduleId));
  }

  @Get(":moduleId/preview-disable")
  previewDisable(@Param("moduleId") moduleId: string) {
    return this.flags.previewDisable(this.parseModuleId(moduleId));
  }

  @Post(":moduleId/disable")
  disable(
    @Param("moduleId") moduleId: string,
    @CurrentUser() user: User,
    @Body() dto: DisablePlatformModuleDto
  ) {
    return this.flags.disableModule(this.parseModuleId(moduleId), user.id, {
      reason: dto.reason,
      userMessageFr: dto.userMessageFr,
      userMessageEn: dto.userMessageEn,
      scheduledReactivation: dto.scheduledReactivation
        ? new Date(dto.scheduledReactivation)
        : undefined
    });
  }

  @Post(":moduleId/reactivate")
  reactivate(
    @Param("moduleId") moduleId: string,
    @CurrentUser() user: User,
    @Body() dto: ReactivatePlatformModuleDto
  ) {
    return this.flags.reactivateModule(
      this.parseModuleId(moduleId),
      user.id,
      dto.reason
    );
  }

  private parseModuleId(moduleId: string): PlatformModuleId {
    if (!isPlatformModuleId(moduleId)) {
      throw new BadRequestException(`Module inconnu : ${moduleId}`);
    }
    return moduleId;
  }
}
