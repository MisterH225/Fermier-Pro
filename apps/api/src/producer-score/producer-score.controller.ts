import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ProducerProfileGuard } from "../auth/guards/producer-profile.guard";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { ProducerScoreService } from "./producer-score.service";

@Controller("producers")
@UseGuards(SupabaseJwtGuard)
export class ProducerScoreController {
  constructor(private readonly producerScore: ProducerScoreService) {}

  @Get("me/score")
  @UseGuards(ProducerProfileGuard)
  getMyScore(@CurrentUser() user: User) {
    return this.producerScore.getForUser(user.id);
  }

  @Post("me/score/recompute")
  @UseGuards(ProducerProfileGuard)
  recomputeMyScore(@CurrentUser() user: User) {
    return this.producerScore.recomputeForUser(user.id);
  }

  @Get("me/credit-eligibility")
  @UseGuards(ProducerProfileGuard)
  getMyCreditEligibility(@CurrentUser() user: User) {
    return this.producerScore.getCreditEligibility(user.id);
  }
}
