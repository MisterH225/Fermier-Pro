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
import { ListingStatus } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { CreateListingDto } from "./dto/create-listing.dto";
import { PickupListingDto } from "./dto/pickup-listing.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";
import { ListingsService } from "./listings.service";

@Controller("marketplace/listings")
@RequireFeature("marketplace")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard)
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query("mine") mine?: string,
    @Query("status") statusRaw?: string
  ) {
    const mineBool = mine === "true" || mine === "1";
    const status =
      statusRaw &&
      Object.values(ListingStatus).includes(statusRaw as ListingStatus)
        ? (statusRaw as ListingStatus)
        : undefined;
    return this.listings.list(user, mineBool, status);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateListingDto) {
    return this.listings.create(user, dto);
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
  publish(@CurrentUser() user: User, @Param("id") id: string) {
    return this.listings.publish(user, id);
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
  completeHandover(@CurrentUser() user: User, @Param("id") id: string) {
    return this.listings.completeHandover(user, id);
  }
}
