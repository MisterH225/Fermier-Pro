import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { AiService } from "./ai.service";
import { CreateAiRecommendationsDto } from "./dto/create-ai-recommendations.dto";

@Controller("ai")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
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
