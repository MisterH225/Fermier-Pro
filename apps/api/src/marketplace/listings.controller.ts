import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { ListingMarketCategory, ListingStatus } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { CreateListingDto } from "./dto/create-listing.dto";
import { CompleteHandoverDto } from "./dto/complete-handover.dto";
import { PickupListingDto } from "./dto/pickup-listing.dto";
import { PublishListingDto } from "./dto/publish-listing.dto";
import { RenewListingDto } from "./dto/renew-listing.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";
import { ConfirmReceiptDto } from "./dto/confirm-receipt.dto";
import { ConfirmShipmentDto } from "./dto/confirm-shipment.dto";
import { DeliveryDisputeDto } from "./dto/delivery-dispute.dto";
import { MarketplaceTransactionService } from "./escrow/marketplace-transaction.service";
import { ListingsService } from "./listings.service";

@Controller("marketplace/listings")
@RequireFeature("marketplace")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard)
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly transactions: MarketplaceTransactionService
  ) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query("mine") mine?: string,
    @Query("status") statusRaw?: string,
    @Query("category") categoryRaw?: string,
    @Query("q") q?: string
  ) {
    const mineBool = mine === "true" || mine === "1";
    const status =
      statusRaw &&
      Object.values(ListingStatus).includes(statusRaw as ListingStatus)
        ? (statusRaw as ListingStatus)
        : undefined;
    const category =
      categoryRaw &&
      Object.values(ListingMarketCategory).includes(
        categoryRaw as ListingMarketCategory
      )
        ? (categoryRaw as ListingMarketCategory)
        : undefined;
    return this.listings.list(user, mineBool, status, category, q);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateListingDto) {
    return this.listings.create(user, dto);
  }

  @Post(":id/view")
  view(@CurrentUser() user: User, @Param("id") id: string) {
    return this.listings.recordView(user, id);
  }

  @Post(":id/consult")
  consult(@CurrentUser() user: User, @Param("id") id: string) {
    return this.listings.recordConsultation(user, id);
  }

  @Get(":id")
  one(@CurrentUser() user: User, @Param("id") id: string) {
    return this.listings.getById(user, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateListingDto
  ) {
    return this.listings.update(user, id, dto);
  }

  @Post(":id/publish")
  publish(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: PublishListingDto
  ) {
    return this.listings.publish(user, id, dto);
  }

  @Post(":id/renew")
  renew(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: RenewListingDto
  ) {
    return this.listings.renew(user, id, dto);
  }

  @Post(":id/cancel")
  cancel(@CurrentUser() user: User, @Param("id") id: string) {
    return this.listings.cancel(user, id);
  }

  @Patch(":id/pickup")
  patchPickup(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: PickupListingDto
  ) {
    return this.listings.patchPickup(user, id, dto);
  }

  @Post(":id/complete-handover")
  completeHandover(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: CompleteHandoverDto
  ) {
    return this.listings.completeHandover(user, id, dto);
  }

  @Get(":id/transaction-status")
  transactionStatus(@CurrentUser() user: User, @Param("id") id: string) {
    return this.transactions.getTransactionStatusForListing(user, id);
  }

  @Post(":id/confirm-shipment")
  async confirmShipment(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: ConfirmShipmentDto
  ) {
    const txId = await this.transactions.requireActiveTransactionIdForListing(
      user,
      id
    );
    return this.transactions.confirmShipment(user, txId, dto);
  }

  @Post(":id/confirm-receipt")
  async confirmReceipt(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: ConfirmReceiptDto
  ) {
    const txId = await this.transactions.requireActiveTransactionIdForListing(
      user,
      id
    );
    return this.transactions.confirmReceipt(user, txId, dto);
  }

  @Post(":id/dispute")
  async openDispute(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: DeliveryDisputeDto
  ) {
    const txId = await this.transactions.requireActiveTransactionIdForListing(
      user,
      id
    );
    return this.transactions.openDeliveryDispute(user, txId, dto);
  }
}
