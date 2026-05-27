import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { OfferStatus } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { CreateBuyerPriceAlertDto } from "./dto/create-price-alert.dto";
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

  @Patch("profile")
  upsertProfile(@CurrentUser() user: User, @Body() dto: UpsertBuyerProfileDto) {
    return this.svc.upsertMe(user, dto);
  }
}
