import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../../auth/guards/supabase-jwt.guard";
import { RequirePlatformModule } from "../../feature-flags/require-platform-module.decorator";
import { PlatformModuleEnabledGuard } from "../../feature-flags/platform-module-enabled.guard";
import { ConfirmReceiptDto } from "../dto/confirm-receipt.dto";
import { ConfirmShipmentDto } from "../dto/confirm-shipment.dto";
import { DeliveryDisputeDto } from "../dto/delivery-dispute.dto";
import { MarketplaceTransactionService } from "./marketplace-transaction.service";

@Controller("marketplace/transactions")
@RequirePlatformModule("marketplace")
@UseGuards(SupabaseJwtGuard, PlatformModuleEnabledGuard)
export class MarketplaceTransactionController {
  constructor(private readonly transactions: MarketplaceTransactionService) {}

  @Get()
  listMine(@CurrentUser() user: User) {
    return this.transactions.listForUser(user);
  }

  @Get("summary")
  financeSummary(@CurrentUser() user: User) {
    return this.transactions.getFinanceSummary(user);
  }

  @Get(":id")
  getOne(@CurrentUser() user: User, @Param("id") id: string) {
    return this.transactions.getById(user, id);
  }

  @Post(":id/payment/initiate")
  initiatePayment(@CurrentUser() user: User, @Param("id") id: string) {
    return this.transactions.initiatePayment(user, id);
  }

  @Post(":id/payment/confirm")
  confirmPayment(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() body: { providerRef?: string }
  ) {
    return this.transactions.confirmPayment(user, id, body.providerRef);
  }

  @Post(":id/confirm-shipment")
  confirmShipment(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() body: ConfirmShipmentDto
  ) {
    return this.transactions.confirmShipment(user, id, body);
  }

  @Post(":id/confirm-receipt")
  confirmReceipt(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() body: ConfirmReceiptDto
  ) {
    return this.transactions.confirmReceipt(user, id, body);
  }

  @Post(":id/delivery-dispute")
  openDeliveryDispute(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() body: DeliveryDisputeDto
  ) {
    return this.transactions.openDeliveryDispute(user, id, body);
  }

  @Post(":id/pickup")
  schedulePickup(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body()
    body: { pickupDate: string; pickupLocation: string; notes?: string }
  ) {
    return this.transactions.schedulePickup(
      user,
      id,
      body.pickupDate,
      body.pickupLocation,
      body.notes
    );
  }

  @Post(":id/weight/declare")
  declareWeight(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() body: { realWeightKg: number; photoUrl?: string }
  ) {
    return this.transactions.declareWeight(
      user,
      id,
      body.realWeightKg,
      body.photoUrl
    );
  }

  @Post(":id/weight/validate")
  validateWeight(@CurrentUser() user: User, @Param("id") id: string) {
    return this.transactions.validateWeight(user, id);
  }

  @Post(":id/weight/dispute")
  disputeWeight(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() body: { reason?: string }
  ) {
    return this.transactions.disputeWeight(user, id, body.reason);
  }

  @Post(":id/cancel")
  cancelByBuyer(@CurrentUser() user: User, @Param("id") id: string) {
    return this.transactions.cancelByBuyer(user, id);
  }

  @Post("listings/:listingId/cancel-seller")
  cancelBySeller(
    @CurrentUser() user: User,
    @Param("listingId") listingId: string,
    @Body() body: { reason?: string }
  ) {
    return this.transactions.cancelBySeller(user, listingId, body.reason);
  }
}
