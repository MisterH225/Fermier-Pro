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
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { AccountStatus, AdminAuditAction } from "@prisma/client";
import { AdminPlatformService } from "./admin-platform.service";
import { AdminAiService } from "./admin-ai.service";
import { AdminUserModerationService } from "./admin-user-moderation.service";
import {
  AdminAiAskDto,
  AdminAiLocaleDto,
  CreateInstitutionConsoleUserDto,
  CreateSanitaryAlertDto,
  CreateSuperAdminDto,
  RejectVetProfileAdminDto,
  UpdateInstitutionConsoleUserDto,
  UpdatePlatformSettingsDto
} from "./dto/admin-platform.dto";
import {
  BanUserDto,
  BulkAdminMessageDto,
  DeleteAccountAdminDto,
  DeleteProfileAdminDto,
  SendAdminMessageToUserDto,
  SuspendUserDto,
  UnbanUserDto,
  UnsuspendUserDto,
  WarnUserDto,
  ModerationScopeDto
} from "./dto/admin-user-moderation.dto";
import { SuperAdminGuard } from "./super-admin.guard";
import { ConsoleAccessGuard } from "./console-access.guard";
import { AdminConsoleMenuGuard } from "./admin-console-menu.guard";
import { AdminConsoleAccessService } from "./admin-console-access.service";
import { PigPriceIndexService } from "../market/pig-price-index.service";
import { ResolveDeliveryDisputeDto } from "../marketplace/dto/resolve-delivery-dispute.dto";
import { MarketplaceTransactionService } from "../marketplace/escrow/marketplace-transaction.service";
import { ListingsService } from "../marketplace/listings.service";
import { ReceiptService } from "../marketplace/receipts/receipt.service";
import { VetAppointmentService } from "../vet-appointments/vet-appointment.service";
import { ProducerScoreService } from "../producer-score/producer-score.service";
import { ProducerScore } from "@prisma/client";
import { MerchantCategoriesService } from "../merchant-shop/merchant-categories.service";
import { MerchantModerationService } from "../merchant-shop/merchant-moderation.service";
import {
  CreateMerchantCategoryDto,
  DeleteMerchantProductAdminDto,
  UpdateMerchantCategoryDto
} from "../merchant-shop/dto/merchant-shop.dto";
import { AdminMerchantSubscriptionsService } from "./admin-merchant-subscriptions.service";
import {
  AdminMerchantApplyPromoDto,
  AdminMerchantGrantTrialDto,
  AdminMerchantSubReasonDto
} from "./dto/admin-merchant-subscriptions.dto";
import { AdminCreateMerchantPromoCodeDto } from "./dto/admin-merchant-promo-codes.dto";

@Controller("admin")
@UseGuards(SupabaseJwtGuard, ConsoleAccessGuard, AdminConsoleMenuGuard)
export class AdminPlatformController {
  constructor(
    private readonly admin: AdminPlatformService,
    private readonly adminAi: AdminAiService,
    private readonly moderation: AdminUserModerationService,
    private readonly pigPriceIndex: PigPriceIndexService,
    private readonly marketplaceTransactions: MarketplaceTransactionService,
    private readonly listings: ListingsService,
    private readonly receipts: ReceiptService,
    private readonly vetAppointments: VetAppointmentService,
    private readonly producerScore: ProducerScoreService,
    private readonly consoleAccess: AdminConsoleAccessService,
    private readonly merchantCategories: MerchantCategoriesService,
    private readonly merchantModeration: MerchantModerationService,
    private readonly merchantSubscriptions: AdminMerchantSubscriptionsService
  ) {}

  @Get("me")
  async me(@CurrentUser() user: User) {
    const profile = await this.consoleAccess.requireConsoleAccess(user.id);
    if (profile.role === "institution") {
      await this.consoleAccess.markInstitutionAccepted(user.id);
    }
    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: profile.role,
      permissions:
        profile.permissions === "all" ? "all" : profile.permissions,
      institutionLabel: profile.institutionLabel
    };
  }

  @Get("platform/overview")
  overview() {
    return this.admin.getOverview();
  }

  @Get("vet-profiles")
  listVets(@Query("status") status?: string) {
    return this.admin.listVetProfiles(status);
  }

  @Get("vet-profiles/:id")
  getVet(@Param("id") id: string) {
    return this.admin.getVetProfile(id);
  }

  @Post("vet-profiles/:id/verify")
  verifyVet(@Param("id") id: string) {
    return this.admin.verifyVetProfile(id);
  }

  @Post("vet-profiles/:id/reject")
  rejectVet(@Param("id") id: string, @Body() dto: RejectVetProfileAdminDto) {
    return this.admin.rejectVetProfile(id, dto.reason);
  }

  @Get("users")
  listUsers(
    @Query("search") search?: string,
    @Query("profileType") profileType?: string,
    @Query("isActive") isActive?: string,
    @Query("accountStatus") accountStatus?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string
  ) {
    const activeFilter =
      isActive === "true" ? true : isActive === "false" ? false : undefined;
    const statusParsed =
      accountStatus === "active" ||
      accountStatus === "suspended" ||
      accountStatus === "banned"
        ? (accountStatus as AccountStatus)
        : undefined;
    return this.admin.listUsers({
      search,
      profileType,
      isActive: statusParsed ? undefined : activeFilter,
      accountStatus: statusParsed,
      skip: skip ? Number.parseInt(skip, 10) : undefined,
      take: take ? Number.parseInt(take, 10) : undefined
    });
  }

  @Get("users/:id")
  getUser(@Param("id") id: string) {
    return this.admin.getUserDetail(id);
  }

  @Patch("users/:id/suspend")
  suspendUser(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: SuspendUserDto
  ) {
    return this.moderation.suspendUser(admin.id, id, dto);
  }

  @Patch("users/:id/unsuspend")
  unsuspendUser(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: UnsuspendUserDto
  ) {
    return this.moderation.unsuspendUser(admin.id, id, dto);
  }

  @Patch("users/:id/ban")
  banUser(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: BanUserDto
  ) {
    return this.moderation.banUser(admin.id, id, dto);
  }

  @Patch("users/:id/unban")
  unbanUser(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: UnbanUserDto
  ) {
    return this.moderation.unbanUser(admin.id, id, dto);
  }

  @Delete("users/:id/account")
  deleteAccount(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: DeleteAccountAdminDto
  ) {
    return this.moderation.deleteAccount(admin.id, id, dto);
  }

  @Post("users/:id/warn")
  warnUser(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: WarnUserDto
  ) {
    return this.moderation.warnUser(admin.id, id, dto);
  }

  @Post("messages")
  sendMessage(@CurrentUser() admin: User, @Body() body: SendAdminMessageToUserDto) {
    const { userId, ...dto } = body;
    return this.moderation.sendMessage(admin.id, userId, dto);
  }

  @Post("messages/bulk")
  bulkMessage(@CurrentUser() admin: User, @Body() dto: BulkAdminMessageDto) {
    return this.moderation.sendBulkMessage(admin.id, dto);
  }

  @Get("messages")
  listMessages(@Query("userId") userId: string, @Query("skip") skip?: string, @Query("take") take?: string) {
    return this.moderation.listMessagesForUser(
      userId,
      skip ? Number.parseInt(skip, 10) : undefined,
      take ? Number.parseInt(take, 10) : undefined
    );
  }

  @Get("audit-logs")
  auditLogs(
    @Query("userId") userId?: string,
    @Query("adminId") adminId?: string,
    @Query("action") action?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string
  ) {
    const actionParsed = action
      ? (Object.values(AdminAuditAction) as string[]).includes(action)
        ? (action as AdminAuditAction)
        : undefined
      : undefined;
    return this.moderation.listAuditLogs({
      userId,
      adminId,
      action: actionParsed,
      skip: skip ? Number.parseInt(skip, 10) : undefined,
      take: take ? Number.parseInt(take, 10) : undefined
    });
  }

  @Patch("profiles/veterinarian/:userId/suspend")
  suspendVetProfile(
    @CurrentUser() admin: User,
    @Param("userId") userId: string,
    @Body() dto: SuspendUserDto
  ) {
    return this.moderation.suspendUser(admin.id, userId, {
      ...dto,
      scope: ModerationScopeDto.veterinarian
    });
  }

  @Delete("profiles/veterinarian/:userId")
  deleteVetProfile(
    @CurrentUser() admin: User,
    @Param("userId") userId: string,
    @Body() dto: DeleteProfileAdminDto
  ) {
    return this.moderation.deleteVetProfile(admin.id, userId, dto);
  }

  @Delete("profiles/producer/:userId")
  deleteProducerProfile(
    @CurrentUser() admin: User,
    @Param("userId") userId: string,
    @Body() dto: DeleteProfileAdminDto
  ) {
    return this.moderation.deleteProducerProfile(admin.id, userId, dto);
  }

  @Get("health-map")
  healthMap(
    @Query("periodDays") periodDays?: string,
    @Query("granularity") granularity?: string
  ) {
    const days = periodDays ? Number.parseInt(periodDays, 10) : 30;
    const level =
      granularity === "country" ||
      granularity === "city" ||
      granularity === "sector"
        ? granularity
        : "sector";
    return this.admin.getHealthMap(
      Number.isFinite(days) ? days : 30,
      level
    );
  }

  @Get("stats")
  stats(@Query("period") period?: "month" | "quarter" | "year") {
    return this.admin.getStats(period ?? "month");
  }

  @Get("settings")
  settings() {
    return this.admin.getSettings();
  }

  @Patch("settings")
  updateSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.admin.updateSettings(dto);
  }

  @Get("sanitary-alerts")
  sanitaryAlerts(@Query("all") all?: string) {
    return this.admin.listSanitaryAlerts(all !== "true");
  }

  @Post("sanitary-alerts")
  createAlert(@CurrentUser() user: User, @Body() dto: CreateSanitaryAlertDto) {
    return this.admin.createSanitaryAlert(user, dto);
  }

  @Get("superadmins")
  @UseGuards(SuperAdminGuard)
  superAdmins() {
    return this.admin.listSuperAdmins();
  }

  @Post("superadmins")
  @UseGuards(SuperAdminGuard)
  createSuperAdmin(
    @CurrentUser() user: User,
    @Body() dto: CreateSuperAdminDto
  ) {
    return this.admin.createSuperAdmin(user, dto);
  }

  @Delete("superadmins/:userId")
  @UseGuards(SuperAdminGuard)
  removeSuperAdmin(
    @CurrentUser() user: User,
    @Param("userId") userId: string
  ) {
    return this.admin.removeSuperAdmin(user, userId);
  }

  @Get("institution-users")
  @UseGuards(SuperAdminGuard)
  institutionUsers() {
    return this.admin.listInstitutionConsoleUsers();
  }

  @Post("institution-users")
  @UseGuards(SuperAdminGuard)
  createInstitutionUser(
    @CurrentUser() user: User,
    @Body() dto: CreateInstitutionConsoleUserDto
  ) {
    return this.admin.createInstitutionConsoleUser(user, dto);
  }

  @Patch("institution-users/:id")
  @UseGuards(SuperAdminGuard)
  updateInstitutionUser(
    @Param("id") id: string,
    @Body() dto: UpdateInstitutionConsoleUserDto
  ) {
    return this.admin.updateInstitutionConsoleUser(id, dto);
  }

  @Delete("institution-users/:id")
  @UseGuards(SuperAdminGuard)
  removeInstitutionUser(@Param("id") id: string) {
    return this.admin.removeInstitutionConsoleUser(id);
  }

  @Post("institution-users/:id/resend-invite")
  @UseGuards(SuperAdminGuard)
  resendInstitutionInvite(
    @Param("id") id: string,
    @Body() body: { redirectTo?: string }
  ) {
    return this.admin.resendInstitutionConsoleInvite(id, body.redirectTo);
  }

  @Get("ai/status")
  aiStatus() {
    return this.adminAi.getStatus();
  }

  @Post("ai/epidemic-analysis")
  aiEpidemic(@Body() dto: AdminAiLocaleDto) {
    return this.adminAi.epidemicAnalysis(dto.locale ?? "fr");
  }

  @Post("ai/ask")
  aiAsk(@Body() dto: AdminAiAskDto) {
    return this.adminAi.ask(dto.question, dto.locale ?? "fr");
  }

  @Post("ai/vet-assist/:id")
  aiVetAssist(@Param("id") id: string, @Body() dto: AdminAiLocaleDto) {
    return this.adminAi.vetAssist(id, dto.locale ?? "fr");
  }

  @Get("pig-price-index")
  adminPigPriceChart(
    @Query("period") period?: string,
    @Query("category") category?: string
  ) {
    return this.pigPriceIndex.getChart(period, category);
  }

  @Get("pig-price-index/stats")
  adminPigPriceStats(@Query("period") period?: string) {
    return this.pigPriceIndex.getStats(period);
  }

  @Get("pig-price-index/ticker")
  adminPigPriceTicker() {
    return this.pigPriceIndex.getTicker();
  }

  @Get("pig-price-index/hybrid")
  async adminHybridIndex() {
    const [current, snapshots, flagged, contributors] = await Promise.all([
      this.pigPriceIndex.getHybridPublicIndex(),
      this.pigPriceIndex.getHybridSnapshots(30),
      this.pigPriceIndex.getHybridFlaggedListings(50),
      this.pigPriceIndex.getHybridTopContributors(10)
    ]);
    const latestSnapshot = snapshots[0] ?? null;
    return {
      current,
      isFrozen: latestSnapshot?.isFrozen ?? false,
      freezeReason: latestSnapshot?.freezeReason ?? null,
      snapshots: snapshots.map((s) => ({
        id: s.id,
        calculatedAt: s.calculatedAt.toISOString(),
        indexValue: Number(s.indexValue),
        confirmedCount: s.confirmedCount,
        listingCount: s.listingCount,
        totalWeightKg: Number(s.totalWeightKg),
        isFrozen: s.isFrozen,
        freezeReason: s.freezeReason
      })),
      flaggedListings: flagged.map((f) => ({
        id: f.id,
        listingId: f.listingId,
        sellerUserId: f.sellerUserId,
        pricePerKg: Number(f.pricePerKg),
        deviationPct: Number(f.deviationPct),
        flaggedAt: f.flaggedAt.toISOString()
      })),
      topContributors: contributors
    };
  }

  @Post("pig-price-index/hybrid/unfreeze")
  adminUnfreezeHybridIndex() {
    return this.pigPriceIndex.unfreezeHybridIndex();
  }

  @Post("pig-price-index/hybrid/recalculate")
  adminRecalculateHybridIndex() {
    return this.pigPriceIndex.calculateHybridIndex();
  }

  @Get("marketplace/overview")
  adminMarketplaceOverview() {
    return this.marketplaceTransactions.getOverviewForAdmin();
  }

  @Get("marketplace/listings")
  adminListListings(@Query("status") status?: string) {
    return this.marketplaceTransactions.listListingsForAdmin(status);
  }

  @Get("marketplace/listings/:id")
  adminGetListing(@Param("id") id: string) {
    return this.listings.getForAdmin(id);
  }

  @Delete("marketplace/listings/:id")
  adminDeleteListing(@Param("id") id: string) {
    return this.listings.deleteForAdmin(id);
  }

  @Get("marketplace/transactions")
  adminListTransactions(@Query("status") status?: string) {
    return this.marketplaceTransactions.listForAdmin(status);
  }

  @Get("marketplace/disputes")
  adminListDisputes() {
    return this.marketplaceTransactions.listDisputesForAdmin();
  }

  @Patch("marketplace/disputes/:id/resolve")
  adminResolveDeliveryDispute(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() body: ResolveDeliveryDisputeDto
  ) {
    return this.marketplaceTransactions.resolveDeliveryDispute(admin.id, id, body);
  }

  @Post("marketplace/transactions/:id/arbitrate")
  adminArbitrateWeight(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() body: { arbitrationWeightKg: number }
  ) {
    return this.marketplaceTransactions.arbitrateWeight(
      admin.id,
      id,
      body.arbitrationWeightKg
    );
  }

  @Get("marketplace/revenue")
  adminPlatformRevenue(@Query("period") period?: string) {
    return this.marketplaceTransactions.getPlatformRevenueAdmin(period);
  }

  @Get("marketplace/receipts")
  adminListReceipts(
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const statusParsed =
      status === "pending" || status === "generated" || status === "failed"
        ? status
        : undefined;
    return this.receipts.listForAdmin({
      status: statusParsed,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined
    });
  }

  @Post("marketplace/receipts/regenerate/:transactionId")
  adminRegenerateReceipt(@Param("transactionId") transactionId: string) {
    return this.receipts.generateReceipt(transactionId, { force: true });
  }

  @Get("marketplace/receipts/:receiptId/download")
  adminDownloadReceipt(@Param("receiptId") receiptId: string) {
    return this.receipts.adminDownload(receiptId);
  }

  @Get("vet-appointments")
  adminListVetAppointments(@Query("status") status?: string) {
    return this.vetAppointments.listForAdmin(status);
  }

  @Post("vet-appointments/:id/refund")
  adminRefundVetAppointment(
    @Param("id") id: string,
    @Body() body: { amount?: number }
  ) {
    return this.vetAppointments.adminManualRefund(id, body.amount);
  }

  @Get("vet-appointments/revenue")
  adminVetAppointmentRevenue(@Query("period") period?: string) {
    return this.vetAppointments.getAdminRevenue(period);
  }

  @Get("producers/scores")
  listProducerScores(@Query("score") score?: ProducerScore) {
    return this.producerScore.listForAdmin({
      score: score && Object.values(ProducerScore).includes(score) ? score : undefined
    });
  }

  @Patch("producers/:userId/credit-blocked")
  setProducerCreditBlocked(
    @Param("userId") userId: string,
    @Body() body: { blocked: boolean; reason?: string | null }
  ) {
    return this.producerScore.adminSetCreditBlocked(
      userId,
      body.blocked === true,
      body.reason
    );
  }

  @Post("producers/:userId/score/recompute")
  recomputeProducerScore(@Param("userId") userId: string) {
    return this.producerScore.recomputeForUser(userId);
  }

  @Get("merchant/categories")
  adminListMerchantCategories() {
    return this.merchantCategories.listAdmin();
  }

  @Get("merchant-subscription-invoices")
  adminListMerchantSubscriptionInvoices(
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Query("profileId") profileId?: string,
    @Query("take") take?: string
  ) {
    return this.merchantSubscriptions.listInvoices({
      status,
      q,
      profileId,
      take: take ? Number(take) : undefined
    });
  }

  @Get("merchant-subscription-invoices/:invoiceId")
  adminGetMerchantSubscriptionInvoice(
    @Param("invoiceId") invoiceId: string,
    @Query("verify") verify?: string
  ) {
    return this.merchantSubscriptions.getInvoice(
      invoiceId,
      verify === "true" || verify === "1"
    );
  }

  @Get("merchant-subscriptions")
  adminListMerchantSubscriptions(
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Query("take") take?: string
  ) {
    return this.merchantSubscriptions.list({
      status,
      q,
      take: take ? Number(take) : undefined
    });
  }

  @Post("merchant-subscriptions/:profileId/suspend")
  adminSuspendMerchantSubscription(
    @Param("profileId") profileId: string,
    @Body() body: AdminMerchantSubReasonDto
  ) {
    return this.merchantSubscriptions.suspend(profileId, body.reason);
  }

  @Post("merchant-subscriptions/:profileId/resume")
  adminResumeMerchantSubscription(@Param("profileId") profileId: string) {
    return this.merchantSubscriptions.resume(profileId);
  }

  @Post("merchant-subscriptions/:profileId/cancel")
  adminCancelMerchantSubscription(
    @Param("profileId") profileId: string,
    @Body() body: AdminMerchantSubReasonDto
  ) {
    return this.merchantSubscriptions.cancel(profileId, body.reason);
  }

  @Post("merchant-subscriptions/:profileId/grant-trial")
  adminGrantMerchantTrial(
    @Param("profileId") profileId: string,
    @Body() body: AdminMerchantGrantTrialDto
  ) {
    return this.merchantSubscriptions.grantTrial(profileId, body.units);
  }

  @Post("merchant-subscriptions/:profileId/apply-promo")
  adminApplyMerchantPromo(
    @Param("profileId") profileId: string,
    @Body() body: AdminMerchantApplyPromoDto
  ) {
    return this.merchantSubscriptions.applyPromo(profileId, body.percentOff);
  }

  @Post("merchant-subscriptions/:profileId/trigger-renewal")
  adminTriggerMerchantRenewal(@Param("profileId") profileId: string) {
    return this.merchantSubscriptions.triggerRenewal(profileId);
  }

  @Get("merchant-subscription-promo-codes")
  adminListMerchantPromoCodes(@Query("activeOnly") activeOnly?: string) {
    return this.merchantSubscriptions.listPromoCodes(activeOnly === "true");
  }

  @Post("merchant-subscription-promo-codes")
  adminCreateMerchantPromoCode(
    @CurrentUser() admin: User,
    @Body() body: AdminCreateMerchantPromoCodeDto
  ) {
    return this.merchantSubscriptions.createPromoCode(
      {
        type: body.type,
        label: body.label,
        code: body.code,
        percentOff: body.percentOff,
        trialUnits: body.trialUnits,
        maxRedemptions: body.maxRedemptions,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null
      },
      admin.id
    );
  }

  @Post("merchant-subscription-promo-codes/:id/deactivate")
  adminDeactivateMerchantPromoCode(@Param("id") id: string) {
    return this.merchantSubscriptions.deactivatePromoCode(id);
  }

  @Post("merchant/categories")
  @UseGuards(SuperAdminGuard)
  adminCreateMerchantCategory(@Body() dto: CreateMerchantCategoryDto) {
    return this.merchantCategories.create(dto);
  }

  @Patch("merchant/categories/:id")
  @UseGuards(SuperAdminGuard)
  adminUpdateMerchantCategory(
    @Param("id") id: string,
    @Body() dto: UpdateMerchantCategoryDto
  ) {
    return this.merchantCategories.update(id, dto);
  }

  @Delete("merchant/categories/:id")
  @UseGuards(SuperAdminGuard)
  adminDeleteMerchantCategory(@Param("id") id: string) {
    return this.merchantCategories.remove(id);
  }

  @Get("merchant/products")
  adminListMerchantProducts() {
    return this.merchantModeration.listAllProducts();
  }

  @Delete("merchant/products/:id")
  @UseGuards(SuperAdminGuard)
  adminDeleteMerchantProduct(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: DeleteMerchantProductAdminDto
  ) {
    return this.merchantModeration.deleteProduct(admin, id, dto);
  }
}
