import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { RequirePlatformModule } from "../feature-flags/require-platform-module.decorator";
import { PlatformModuleEnabledGuard } from "../feature-flags/platform-module-enabled.guard";
import { AiService } from "./ai.service";
import { CreateAiRecommendationsDto } from "./dto/create-ai-recommendations.dto";

@Controller("ai")
@RequirePlatformModule("ai_assistant")
@UseGuards(SupabaseJwtGuard, PlatformModuleEnabledGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("recommendations")
  recommendations(
    @CurrentUser() user: User,
    @Body() dto: CreateAiRecommendationsDto
  ) {
    return this.ai.getRecommendations(user, dto);
  }
}
