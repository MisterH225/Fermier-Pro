import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import {
  isPlatformModuleId,
  type PlatformModuleId
} from "./platform-modules.constants";
import { PlatformFeatureFlagsService } from "./platform-feature-flags.service";
import { NotifyModuleReactivationDto } from "./dto/platform-feature-flags.dto";

@Controller("platform/feature-flags")
@SkipThrottle()
export class PlatformFeatureFlagsController {
  constructor(private readonly flags: PlatformFeatureFlagsService) {}

  /** GET /api/v1/platform/feature-flags — public */
  @Get()
  list() {
    return this.flags.listPublicModules();
  }

  @Get(":moduleId")
  async getOne(@Param("moduleId") moduleId: string) {
    const id = this.parseModuleId(moduleId);
    const row = (await this.flags.listPublicModules()).find(
      (r) => r.moduleId === id
    );
    if (!row) {
      throw new NotFoundException(`Module inconnu : ${moduleId}`);
    }
    return row;
  }

  /** POST /api/v1/platform/feature-flags/:moduleId/notify-me */
  @Post(":moduleId/notify-me")
  @UseGuards(SupabaseJwtGuard)
  notifyMe(
    @Param("moduleId") moduleId: string,
    @CurrentUser() user: User,
    @Body() _dto: NotifyModuleReactivationDto
  ) {
    return this.flags.joinWaitlist(this.parseModuleId(moduleId), user.id);
  }

  private parseModuleId(moduleId: string): PlatformModuleId {
    if (!isPlatformModuleId(moduleId)) {
      throw new BadRequestException(`Module inconnu : ${moduleId}`);
    }
    return moduleId;
  }
}
