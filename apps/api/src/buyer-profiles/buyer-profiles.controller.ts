import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { OfferStatus } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { CreateBuyerFavoriteDto } from "./dto/create-buyer-favorite.dto";
import { CreateBuyerPriceAlertDto } from "./dto/create-price-alert.dto";
import { UpdateBuyerPriceAlertDto } from "./dto/update-price-alert.dto";
import { UpsertBuyerProfileDto } from "./dto/upsert-buyer-profile.dto";
import { BuyerProfilesService } from "./buyer-profiles.service";

@Controller("buyers/me")
@UseGuards(SupabaseJwtGuard)
export class BuyerProfilesController {
  constructor(private readonly svc: BuyerProfilesService) {}

  @Get("dashboard")
  dashboard(@CurrentUser() user: User) {
    return this.svc.dashboard(user);
  }

  @Get("proposals")
  proposals(
    @CurrentUser() user: User,
    @Query("status") status?: OfferStatus
  ) {
    return this.svc.listProposals(user, status);
  }

  @Get("purchases")
  purchases(@CurrentUser() user: User) {
    return this.svc.listPurchases(user);
  }

  @Get("reviews")
  reviews(@CurrentUser() user: User) {
    return this.svc.listReviews(user);
  }

  @Get("favorites")
  favorites(@CurrentUser() user: User) {
    return this.svc.listFavorites(user);
  }

  @Get("favorites/ids")
  favoriteIds(@CurrentUser() user: User) {
    return this.svc.listFavoriteIds(user);
  }

  @Post("favorites")
  createFavorite(
    @CurrentUser() user: User,
    @Body() dto: CreateBuyerFavoriteDto
  ) {
    return this.svc.addFavorite(user, dto.listingId);
  }

  @Delete("favorites/:listingId")
  deleteFavorite(
    @CurrentUser() user: User,
    @Param("listingId") listingId: string
  ) {
    return this.svc.removeFavorite(user, listingId);
  }

  @Get("personalized-listings")
  personalizedListings(@CurrentUser() user: User) {
    return this.svc.personalizedListings(user);
  }

  @Get("price-alerts")
  priceAlerts(@CurrentUser() user: User) {
    return this.svc.listPriceAlerts(user);
  }

  @Post("price-alerts")
  createPriceAlert(
    @CurrentUser() user: User,
    @Body() dto: CreateBuyerPriceAlertDto
  ) {
    return this.svc.createPriceAlert(user, dto);
  }


  @Patch("price-alerts/:id")
  updatePriceAlert(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateBuyerPriceAlertDto
  ) {
    return this.svc.updatePriceAlert(user, id, dto);
  }

  @Delete("price-alerts/:id")
  deletePriceAlert(@CurrentUser() user: User, @Param("id") id: string) {
    return this.svc.deletePriceAlert(user, id);
  }

  @Patch("profile")
  upsertProfile(@CurrentUser() user: User, @Body() dto: UpsertBuyerProfileDto) {
    return this.svc.upsertMe(user, dto);
  }
}
