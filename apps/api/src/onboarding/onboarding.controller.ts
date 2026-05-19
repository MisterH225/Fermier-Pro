import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ProducerProfileGuard } from "../auth/guards/producer-profile.guard";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { CompleteOnboardingDto } from "./dto/complete-onboarding.dto";
import { OnboardingService } from "./onboarding.service";

@Controller("onboarding")
@UseGuards(SupabaseJwtGuard, ProducerProfileGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get("status")
  status(@CurrentUser() user: User) {
    return this.onboarding.getStatus(user.id);
  }

  @Post("complete")
  complete(@CurrentUser() user: User, @Body() dto: CompleteOnboardingDto) {
    return this.onboarding.complete(user, dto);
  }

  @Post("skip")
  skip(@CurrentUser() user: User) {
    return this.onboarding.skip(user.id);
  }
}
