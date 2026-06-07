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
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../../auth/guards/supabase-jwt.guard";
import { RequirePlatformModule } from "../../feature-flags/require-platform-module.decorator";
import { PlatformModuleEnabledGuard } from "../../feature-flags/platform-module-enabled.guard";
import { CreditScoreService } from "./credit-score.service";
import { CreditOffersService } from "./credit-offers.service";
import { CreateCreditOfferDto } from "./dto/create-credit-offer.dto";
import {
  CreditBalanceDeclareDto,
  CreditConfirmReceivedDto,
  CreditPaymentDeclareDto,
  ResolveCreditArbitrationDto
} from "./dto/credit-payment.dto";

@Controller("marketplace")
@RequirePlatformModule("marketplace")
@UseGuards(SupabaseJwtGuard, PlatformModuleEnabledGuard)
export class CreditOffersController {
  constructor(
    private readonly creditOffers: CreditOffersService,
    private readonly creditScore: CreditScoreService
  ) {}

  @Post("offers/credit")
  createCredit(
    @CurrentUser() user: User,
    @Body() body: CreateCreditOfferDto & { listingId: string }
  ) {
    return this.creditOffers.createCreditOffer(user, body.listingId, body);
  }

  @Post("listings/:listingId/offers/credit")
  createCreditOnListing(
    @CurrentUser() user: User,
    @Param("listingId") listingId: string,
    @Body() body: CreateCreditOfferDto
  ) {
    return this.creditOffers.createCreditOffer(user, listingId, body);
  }

  @Patch("offers/:offerId/counter-credit")
  counterCredit(
    @CurrentUser() user: User,
    @Param("offerId") offerId: string,
    @Body() body: CreateCreditOfferDto & { listingId: string }
  ) {
    return this.creditOffers.counterCredit(
      user,
      body.listingId,
      offerId,
      body
    );
  }

  @Patch("listings/:listingId/offers/:offerId/counter-credit")
  counterCreditOnListing(
    @CurrentUser() user: User,
    @Param("listingId") listingId: string,
    @Param("offerId") offerId: string,
    @Body() body: CreateCreditOfferDto
  ) {
    return this.creditOffers.counterCredit(user, listingId, offerId, body);
  }

  @Patch("listings/:listingId/offers/:offerId/agree-credit")
  agreeCredit(
    @CurrentUser() user: User,
    @Param("listingId") listingId: string,
    @Param("offerId") offerId: string
  ) {
    return this.creditOffers.agreeCredit(user, listingId, offerId);
  }

  @Patch("offers/:offerId/confirm-advance-paid")
  declareAdvance(
    @CurrentUser() user: User,
    @Param("offerId") offerId: string,
    @Body() body: CreditPaymentDeclareDto
  ) {
    return this.creditOffers.declareAdvancePaid(user, offerId, body);
  }

  @Patch("offers/:offerId/confirm-advance-received")
  confirmAdvance(
    @CurrentUser() user: User,
    @Param("offerId") offerId: string,
    @Body() body: CreditConfirmReceivedDto
  ) {
    return this.creditOffers.confirmAdvanceReceived(
      user,
      offerId,
      body.received
    );
  }

  @Patch("offers/:offerId/confirm-balance-paid")
  declareBalance(
    @CurrentUser() user: User,
    @Param("offerId") offerId: string,
    @Body() body: CreditBalanceDeclareDto
  ) {
    return this.creditOffers.declareBalancePaid(user, offerId, body);
  }

  @Patch("offers/:offerId/confirm-balance-received")
  confirmBalance(
    @CurrentUser() user: User,
    @Param("offerId") offerId: string,
    @Body() body: CreditConfirmReceivedDto
  ) {
    return this.creditOffers.confirmBalanceReceived(
      user,
      offerId,
      body.received
    );
  }

  @Get("offers/credit-pending")
  listPending(
    @CurrentUser() user: User,
    @Query("farmId") farmId?: string
  ) {
    return this.creditOffers.listCreditPending(user, farmId?.trim());
  }

  @Get("buyers/:buyerUserId/credit-score")
  getBuyerScore(
    @CurrentUser() user: User,
    @Param("buyerUserId") buyerUserId: string
  ) {
    if (user.id !== buyerUserId) {
      return this.creditScore.getForUser(buyerUserId);
    }
    return this.creditScore.getForUser(buyerUserId);
  }

  @Get("buyers/me/credit-score")
  myScore(@CurrentUser() user: User) {
    return this.creditScore.getForUser(user.id);
  }

  @Patch("arbitrations/:id/resolve")
  resolveArbitration(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() body: ResolveCreditArbitrationDto
  ) {
    return this.creditOffers.resolveArbitration(
      user,
      id,
      body.resolution,
      body.notes
    );
  }
}
