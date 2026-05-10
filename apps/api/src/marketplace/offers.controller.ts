import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { OffersService } from "./offers.service";

@Controller("marketplace")
@RequireFeature("marketplace")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard)
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get("offers")
  listMine(@CurrentUser() user: User) {
    return this.offers.listMine(user);
  }

  @Post("listings/:listingId/offers")
  create(
    @CurrentUser() user: User,
    @Param("listingId") listingId: string,
    @Body() dto: CreateOfferDto
  ) {
    return this.offers.create(user, listingId, dto);
  }

  @Post("listings/:listingId/offers/:offerId/accept")
  accept(
    @CurrentUser() user: User,
    @Param("listingId") listingId: string,
    @Param("offerId") offerId: string
  ) {
    return this.offers.accept(user, listingId, offerId);
  }

  @Post("listings/:listingId/offers/:offerId/reject")
  reject(
    @CurrentUser() user: User,
    @Param("listingId") listingId: string,
    @Param("offerId") offerId: string
  ) {
    return this.offers.reject(user, listingId, offerId);
  }

  @Post("offers/:offerId/withdraw")
  withdraw(@CurrentUser() user: User, @Param("offerId") offerId: string) {
    return this.offers.withdraw(user, offerId);
  }
}
