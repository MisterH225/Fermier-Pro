import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { CreateBuyerRatingDto } from "./dto/create-buyer-rating.dto";
import { CreateMerchantRatingDto } from "./dto/create-merchant-rating.dto";
import { CreateTechnicianRatingDto } from "./dto/create-technician-rating.dto";
import { CrossRatingsService } from "./cross-ratings.service";

@Controller("cross-ratings")
@UseGuards(SupabaseJwtGuard)
export class CrossRatingsController {
  constructor(private readonly ratings: CrossRatingsService) {}

  @Post("buyer")
  createBuyer(@CurrentUser() user: User, @Body() dto: CreateBuyerRatingDto) {
    return this.ratings.createBuyerRating(user, dto);
  }

  @Post("merchant")
  createMerchant(
    @CurrentUser() user: User,
    @Body() dto: CreateMerchantRatingDto
  ) {
    return this.ratings.createMerchantRating(user, dto);
  }

  @Post("technician")
  createTechnician(
    @CurrentUser() user: User,
    @Body() dto: CreateTechnicianRatingDto
  ) {
    return this.ratings.createTechnicianRating(user, dto);
  }

  @Get("pending")
  pending(@CurrentUser() user: User) {
    return this.ratings.listPending(user);
  }

  @Get("buyer/:userId/summary")
  buyerSummary(@Param("userId") userId: string) {
    return this.ratings.buyerSummary(userId);
  }

  @Get("merchant/:userId/summary")
  merchantSummary(@Param("userId") userId: string) {
    return this.ratings.merchantSummary(userId);
  }

  @Get("technician/:userId/summary")
  technicianSummary(@Param("userId") userId: string) {
    return this.ratings.technicianSummary(userId);
  }
}
