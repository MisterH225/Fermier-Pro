import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ProducerProfileGuard } from "../auth/guards/producer-profile.guard";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import {
  ChooseProducerSubscriptionDto,
  ConfirmProducerPaymentDto
} from "./dto/producer-subscription.dto";
import { ProducerProfilesService } from "./producer-profiles.service";
import { ProducerSubscriptionService } from "./producer-subscription.service";

@Controller("producers")
@UseGuards(SupabaseJwtGuard)
export class ProducerSubscriptionController {
  constructor(
    private readonly profiles: ProducerProfilesService,
    private readonly subscription: ProducerSubscriptionService
  ) {}

  @Get("me")
  @UseGuards(ProducerProfileGuard)
  getMe(@CurrentUser() user: User) {
    return this.profiles.getMe(user);
  }

  @Post("me/subscription")
  @UseGuards(ProducerProfileGuard)
  chooseSubscription(
    @CurrentUser() user: User,
    @Body() dto: ChooseProducerSubscriptionDto
  ) {
    return this.subscription.choose(user, dto);
  }

  @Post("me/subscription/confirm")
  @UseGuards(ProducerProfileGuard)
  confirmSubscription(
    @CurrentUser() user: User,
    @Body() dto: ConfirmProducerPaymentDto
  ) {
    return this.subscription.confirmPremiumPayment(
      user,
      dto.providerRef,
      dto.invoiceId
    );
  }

  @Post("me/subscription/renew")
  @UseGuards(ProducerProfileGuard)
  renewSubscription(@CurrentUser() user: User) {
    return this.subscription.renew(user);
  }

  @Post("me/subscription/cancel")
  @UseGuards(ProducerProfileGuard)
  cancelSubscription(@CurrentUser() user: User) {
    return this.subscription.cancel(user);
  }
}
