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
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { MerchantProfileGuard } from "../auth/guards/merchant-profile.guard";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { PlatformModuleEnabledGuard } from "../feature-flags/platform-module-enabled.guard";
import { RequirePlatformModule } from "../feature-flags/require-platform-module.decorator";
import {
  CreateMillIngredientOfferDto,
  UpdateMillIngredientOfferDto
} from "./dto/mill-ingredient-offer.dto";
import { MillIngredientOffersService } from "./mill-ingredient-offers.service";

/**
 * Offres d'intrants moulin — gardé par le flag `mills`.
 * isMill vérifié dans le service (profil merchantKind=mill).
 */
@Controller("merchant/mill")
@RequirePlatformModule("mills")
@UseGuards(SupabaseJwtGuard, MerchantProfileGuard, PlatformModuleEnabledGuard)
export class MillIngredientOffersController {
  constructor(private readonly offers: MillIngredientOffersService) {}

  @Get("ingredients")
  searchIngredients(
    @CurrentUser() user: Parameters<MillIngredientOffersService["searchIngredients"]>[0],
    @Query("q") q?: string
  ) {
    return this.offers.searchIngredients(user, q);
  }

  @Get("offers")
  listMine(
    @CurrentUser() user: Parameters<MillIngredientOffersService["listMine"]>[0]
  ) {
    return this.offers.listMine(user);
  }

  @Post("offers")
  create(
    @CurrentUser() user: Parameters<MillIngredientOffersService["create"]>[0],
    @Body() dto: CreateMillIngredientOfferDto
  ) {
    return this.offers.create(user, dto);
  }

  @Patch("offers/:id")
  update(
    @CurrentUser() user: Parameters<MillIngredientOffersService["update"]>[0],
    @Param("id") id: string,
    @Body() dto: UpdateMillIngredientOfferDto
  ) {
    return this.offers.update(user, id, dto);
  }

  @Delete("offers/:id")
  deactivate(
    @CurrentUser() user: Parameters<MillIngredientOffersService["deactivate"]>[0],
    @Param("id") id: string
  ) {
    return this.offers.deactivate(user, id);
  }
}
