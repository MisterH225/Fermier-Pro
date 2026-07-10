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
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { MerchantProfileGuard } from "../auth/guards/merchant-profile.guard";
import {
  ChooseMerchantSubscriptionDto,
  ConfirmMerchantPaymentDto,
  CreateMerchantProductDto,
  CreateMerchantShopDto,
  OpenMerchantOrderDisputeDto,
  PatchMerchantOnboardingDto,
  PurchaseMerchantProductDto,
  RespondMerchantOrderDisputeDto,
  UpdateMerchantProductDto,
  UpdateMerchantShopDto,
  ValidateMerchantPromoCodeDto
} from "./dto/merchant-shop.dto";
import { MerchantCategoriesService } from "./merchant-categories.service";
import { MerchantDashboardService } from "./merchant-dashboard.service";
import { MerchantOrdersService } from "./merchant-orders.service";
import { MerchantProductsService } from "./merchant-products.service";
import { MerchantProfilesService } from "./merchant-profiles.service";
import { MerchantShopsService } from "./merchant-shops.service";
import { MerchantSubscriptionService } from "./merchant-subscription.service";

@Controller("merchant")
@UseGuards(SupabaseJwtGuard)
export class MerchantShopController {
  constructor(
    private readonly profiles: MerchantProfilesService,
    private readonly shops: MerchantShopsService,
    private readonly products: MerchantProductsService,
    private readonly categories: MerchantCategoriesService,
    private readonly subscription: MerchantSubscriptionService,
    private readonly orders: MerchantOrdersService,
    private readonly dashboard: MerchantDashboardService
  ) {}

  @Get("me")
  getMe(@CurrentUser() user: Parameters<MerchantProfilesService["getMe"]>[0]) {
    return this.profiles.getMe(user);
  }

  @Patch("me/onboarding")
  patchOnboarding(
    @CurrentUser() user: Parameters<MerchantProfilesService["patchOnboarding"]>[0],
    @Body() dto: PatchMerchantOnboardingDto
  ) {
    return this.profiles.patchOnboarding(user, dto);
  }

  @Post("me/subscription")
  @UseGuards(MerchantProfileGuard)
  chooseSubscription(
    @CurrentUser() user: Parameters<MerchantSubscriptionService["choose"]>[0],
    @Body() dto: ChooseMerchantSubscriptionDto
  ) {
    return this.subscription.choose(user, dto);
  }

  @Post("me/subscription/validate-code")
  @UseGuards(MerchantProfileGuard)
  validateSubscriptionPromoCode(
    @CurrentUser() user: Parameters<MerchantSubscriptionService["validatePromoCode"]>[0],
    @Body() dto: ValidateMerchantPromoCodeDto
  ) {
    return this.subscription.validatePromoCode(user, dto.code);
  }

  @Post("me/subscription/confirm")
  @UseGuards(MerchantProfileGuard)
  confirmSubscription(
    @CurrentUser() user: Parameters<MerchantSubscriptionService["confirmPremiumPayment"]>[0],
    @Body() dto: ConfirmMerchantPaymentDto
  ) {
    return this.subscription.confirmPremiumPayment(
      user,
      dto.providerRef,
      dto.invoiceId
    );
  }

  @Post("me/subscription/renew")
  @UseGuards(MerchantProfileGuard)
  renewSubscription(
    @CurrentUser() user: Parameters<MerchantSubscriptionService["renew"]>[0]
  ) {
    return this.subscription.renew(user);
  }

  @Post("me/subscription/cancel")
  @UseGuards(MerchantProfileGuard)
  cancelSubscription(
    @CurrentUser() user: Parameters<MerchantSubscriptionService["cancel"]>[0]
  ) {
    return this.subscription.cancel(user);
  }

  @Get("dashboard")
  @UseGuards(MerchantProfileGuard)
  getDashboard(
    @CurrentUser() user: Parameters<MerchantDashboardService["getDashboard"]>[0]
  ) {
    return this.dashboard.getDashboard(user);
  }

  @Get("shops")
  @UseGuards(MerchantProfileGuard)
  listShops(@CurrentUser() user: Parameters<MerchantShopsService["list"]>[0]) {
    return this.shops.list(user);
  }

  @Post("shops")
  @UseGuards(MerchantProfileGuard)
  createShop(
    @CurrentUser() user: Parameters<MerchantShopsService["create"]>[0],
    @Body() dto: CreateMerchantShopDto
  ) {
    return this.shops.create(user, dto);
  }

  @Patch("shops/:shopId")
  @UseGuards(MerchantProfileGuard)
  updateShop(
    @CurrentUser() user: Parameters<MerchantShopsService["update"]>[0],
    @Param("shopId") shopId: string,
    @Body() dto: UpdateMerchantShopDto
  ) {
    return this.shops.update(user, shopId, dto);
  }

  @Get("products")
  @UseGuards(MerchantProfileGuard)
  listProducts(@CurrentUser() user: Parameters<MerchantProductsService["listMine"]>[0]) {
    return this.products.listMine(user);
  }

  @Post("shops/:shopId/products")
  @UseGuards(MerchantProfileGuard)
  createProduct(
    @CurrentUser() user: Parameters<MerchantProductsService["create"]>[0],
    @Param("shopId") shopId: string,
    @Body() dto: CreateMerchantProductDto
  ) {
    return this.products.create(user, shopId, dto);
  }

  @Patch("products/:productId")
  @UseGuards(MerchantProfileGuard)
  updateProduct(
    @CurrentUser() user: Parameters<MerchantProductsService["update"]>[0],
    @Param("productId") productId: string,
    @Body() dto: UpdateMerchantProductDto
  ) {
    return this.products.update(user, productId, dto);
  }

  @Post("products/:productId/publish")
  @UseGuards(MerchantProfileGuard)
  publishProduct(
    @CurrentUser() user: Parameters<MerchantProductsService["publish"]>[0],
    @Param("productId") productId: string
  ) {
    return this.products.publish(user, productId);
  }

  @Post("products/:productId/unpublish")
  @UseGuards(MerchantProfileGuard)
  unpublishProduct(
    @CurrentUser() user: Parameters<MerchantProductsService["unpublish"]>[0],
    @Param("productId") productId: string
  ) {
    return this.products.unpublish(user, productId);
  }

  @Post("products/:productId/swap-active")
  @UseGuards(MerchantProfileGuard)
  swapProduct(
    @CurrentUser() user: Parameters<MerchantProductsService["swapActive"]>[0],
    @Param("productId") productId: string
  ) {
    return this.products.swapActive(user, productId);
  }

  @Get("orders/seller")
  @UseGuards(MerchantProfileGuard)
  sellerOrders(@CurrentUser() user: Parameters<MerchantOrdersService["listSellerOrders"]>[0]) {
    return this.orders.listSellerOrders(user);
  }

  @Get("orders/buyer")
  buyerOrders(@CurrentUser() user: Parameters<MerchantOrdersService["listBuyerOrders"]>[0]) {
    return this.orders.listBuyerOrders(user);
  }

  @Get("orders/:orderId")
  getOrder(
    @CurrentUser() user: Parameters<MerchantOrdersService["getOrder"]>[0],
    @Param("orderId") orderId: string
  ) {
    return this.orders.getOrder(user, orderId);
  }

  @Post("orders/:orderId/complete")
  @UseGuards(MerchantProfileGuard)
  completeOrder(
    @CurrentUser() user: Parameters<MerchantOrdersService["completeOrder"]>[0],
    @Param("orderId") orderId: string
  ) {
    return this.orders.completeOrder(user, orderId);
  }

  @Post("orders/:orderId/dispute")
  openDispute(
    @CurrentUser() user: Parameters<MerchantOrdersService["openDispute"]>[0],
    @Param("orderId") orderId: string,
    @Body() dto: OpenMerchantOrderDisputeDto
  ) {
    return this.orders.openDispute(user, orderId, dto);
  }

  @Post("orders/:orderId/dispute/respond")
  respondDispute(
    @CurrentUser() user: Parameters<MerchantOrdersService["respondDispute"]>[0],
    @Param("orderId") orderId: string,
    @Body() dto: RespondMerchantOrderDisputeDto
  ) {
    return this.orders.respondDispute(user, orderId, dto);
  }

  @Get("categories")
  listCategories() {
    return this.categories.listPublic();
  }
}

@Controller("merchant/catalog")
@UseGuards(SupabaseJwtGuard)
export class MerchantCatalogController {
  constructor(
    private readonly products: MerchantProductsService,
    private readonly orders: MerchantOrdersService
  ) {}

  @Get("products")
  listProducts(
    @Query("categoryId") categoryId?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @Query("q") q?: string,
    @Query("sort") sort?: "recent" | "price_asc" | "price_desc" | "popular"
  ) {
    return this.products.listCatalog({
      categoryId: categoryId?.trim() || undefined,
      cursor: cursor?.trim() || undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      q: q?.trim() || undefined,
      sort
    });
  }

  @Get("products/:productId")
  getProduct(@Param("productId") productId: string) {
    return this.products.getCatalogProduct(productId);
  }

  @Post("products/:productId/purchase")
  purchase(
    @CurrentUser() user: Parameters<MerchantOrdersService["initiatePurchase"]>[0],
    @Param("productId") productId: string,
    @Body() dto: PurchaseMerchantProductDto
  ) {
    return this.orders.initiatePurchase(user, productId, dto);
  }

  @Get("orders/:orderId")
  getOrder(
    @CurrentUser() user: Parameters<MerchantOrdersService["getOrder"]>[0],
    @Param("orderId") orderId: string
  ) {
    return this.orders.getOrder(user, orderId);
  }

  @Post("orders/:orderId/payment/confirm")
  confirmPayment(
    @CurrentUser() user: Parameters<MerchantOrdersService["confirmPayment"]>[0],
    @Param("orderId") orderId: string,
    @Body() dto: ConfirmMerchantPaymentDto
  ) {
    return this.orders.confirmPayment(user, orderId, dto);
  }
}
