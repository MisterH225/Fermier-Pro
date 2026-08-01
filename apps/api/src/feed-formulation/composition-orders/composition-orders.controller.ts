import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { User } from "@prisma/client";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { MerchantProfileGuard } from "../../auth/guards/merchant-profile.guard";
import { ProducerProfileGuard } from "../../auth/guards/producer-profile.guard";
import { SupabaseJwtGuard } from "../../auth/guards/supabase-jwt.guard";
import { RequirePlatformModule } from "../../feature-flags/require-platform-module.decorator";
import { PlatformModuleEnabledGuard } from "../../feature-flags/platform-module-enabled.guard";
import { CompositionOrdersService } from "./composition-orders.service";
import {
  ConfirmCompositionPaymentDto,
  CreateCompositionOrderDto,
  PayCompositionOrderDto,
  ReviseCompositionOrderDto,
  UpdateReadyEstimateDto
} from "./dto/composition-order.dto";

@Controller("feed-composition")
@RequirePlatformModule("feed_composition")
@UseGuards(SupabaseJwtGuard, PlatformModuleEnabledGuard)
export class CompositionOrdersController {
  constructor(private readonly orders: CompositionOrdersService) {}

  /** Producteur : Commander → SENT_TO_MILL. */
  @Post("compositions/:compositionId/orders")
  @UseGuards(ProducerProfileGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  sendToMill(
    @CurrentUser() user: User,
    @Param("compositionId") compositionId: string,
    @Body() dto: CreateCompositionOrderDto
  ) {
    return this.orders.sendToMill(user, compositionId, dto);
  }

  @Get("orders/:orderId")
  getOne(@CurrentUser() user: User, @Param("orderId") orderId: string) {
    return this.orders.getOne(user, orderId);
  }

  @Post("orders/:orderId/accept")
  @UseGuards(ProducerProfileGuard)
  accept(@CurrentUser() user: User, @Param("orderId") orderId: string) {
    return this.orders.accept(user, orderId);
  }

  @Post("orders/:orderId/reject")
  @UseGuards(ProducerProfileGuard)
  reject(@CurrentUser() user: User, @Param("orderId") orderId: string) {
    return this.orders.reject(user, orderId);
  }

  @Post("orders/:orderId/cancel")
  @UseGuards(ProducerProfileGuard)
  cancel(@CurrentUser() user: User, @Param("orderId") orderId: string) {
    return this.orders.cancel(user, orderId);
  }

  @Post("orders/:orderId/pay")
  @UseGuards(ProducerProfileGuard)
  pay(
    @CurrentUser() user: User,
    @Param("orderId") orderId: string,
    @Body() dto: PayCompositionOrderDto
  ) {
    return this.orders.initiatePayment(user, orderId, dto);
  }

  @Post("orders/:orderId/confirm-payment")
  @UseGuards(ProducerProfileGuard)
  confirmPayment(
    @CurrentUser() user: User,
    @Param("orderId") orderId: string,
    @Body() dto: ConfirmCompositionPaymentDto
  ) {
    return this.orders.confirmPayment(user, orderId, dto);
  }

  @Post("orders/:orderId/mill-revise")
  @UseGuards(MerchantProfileGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  revise(
    @CurrentUser() user: User,
    @Param("orderId") orderId: string,
    @Body() dto: ReviseCompositionOrderDto
  ) {
    return this.orders.reviseAsMill(user, orderId, dto);
  }

  @Patch("orders/:orderId/ready-estimate")
  @UseGuards(MerchantProfileGuard)
  updateReadyEstimate(
    @CurrentUser() user: User,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateReadyEstimateDto
  ) {
    return this.orders.updateReadyEstimate(user, orderId, dto);
  }

  @Post("orders/:orderId/start-production")
  @UseGuards(MerchantProfileGuard)
  startProduction(
    @CurrentUser() user: User,
    @Param("orderId") orderId: string
  ) {
    return this.orders.startProduction(user, orderId);
  }

  @Post("orders/:orderId/mark-ready")
  @UseGuards(MerchantProfileGuard)
  markReady(@CurrentUser() user: User, @Param("orderId") orderId: string) {
    return this.orders.markReady(user, orderId);
  }
}
