import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import {
  WalletAmountDto,
  WalletLookupRecipientQueryDto,
  WalletTopUpConfirmDto,
  WalletTransferDto,
  WalletWithdrawConfirmDto,
  WalletWithdrawInitiateDto
} from "./dto/wallet-operations.dto";
import { WalletFeeQuoteQueryDto } from "./dto/wallet-admin.dto";
import { UserWalletService } from "./user-wallet.service";
import { WalletRailsService } from "./wallet-rails.service";

@Controller("users/me/wallet")
@UseGuards(SupabaseJwtGuard)
export class WalletController {
  constructor(
    private readonly wallet: UserWalletService,
    private readonly rails: WalletRailsService
  ) {}

  @Get()
  summary(@CurrentUser() user: User) {
    return this.wallet.getSummary(user.id);
  }

  @Get("entries")
  entries(
    @CurrentUser() user: User,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.wallet.listEntries(user.id, {
      limit: Number.isFinite(parsed) ? parsed : undefined,
      cursor: cursor?.trim() || undefined
    });
  }

  @Post("top-up/initiate")
  initiateTopUp(@CurrentUser() user: User, @Body() dto: WalletAmountDto) {
    return this.rails.initiateTopUp(user, dto.amount);
  }

  @Post("top-up/confirm")
  confirmTopUp(@CurrentUser() user: User, @Body() dto: WalletTopUpConfirmDto) {
    return this.rails.confirmTopUp(user, dto.amount, dto.providerRef);
  }

  @Get("fee-quote")
  feeQuote(@Query() query: WalletFeeQuoteQueryDto) {
    return this.rails.quoteFee(query.type, query.amount);
  }

  @Post("withdraw/initiate")
  initiateWithdraw(
    @CurrentUser() user: User,
    @Body() dto: WalletWithdrawInitiateDto
  ) {
    return this.rails.initiateWithdraw(
      user,
      dto.amount,
      dto.phone,
      dto.clientRequestId
    );
  }

  @Post("withdraw/confirm")
  confirmWithdraw(
    @CurrentUser() user: User,
    @Body() dto: WalletWithdrawConfirmDto
  ) {
    return this.rails.confirmWithdraw(
      user,
      dto.amount,
      dto.providerRef,
      dto.phone,
      dto.withdrawalRequestId
    );
  }

  @Get("transfer-recipient")
  lookupTransferRecipient(
    @CurrentUser() user: User,
    @Query() query: WalletLookupRecipientQueryDto
  ) {
    return this.rails.lookupTransferRecipient(user, query.phone);
  }

  @Post("transfer")
  transfer(@CurrentUser() user: User, @Body() dto: WalletTransferDto) {
    return this.rails.transfer(user, dto);
  }
}

/** Rétrocompatibilité mobile — alias vers le portefeuille universel. */
@Controller("buyers/me/wallet")
@UseGuards(SupabaseJwtGuard)
export class LegacyBuyerWalletController {
  constructor(private readonly wallet: UserWalletService) {}

  @Get()
  summary(@CurrentUser() user: User) {
    return this.wallet.getSummary(user.id);
  }

  @Get("entries")
  entries(
    @CurrentUser() user: User,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.wallet.listEntries(user.id, {
      limit: Number.isFinite(parsed) ? parsed : undefined,
      cursor: cursor?.trim() || undefined
    });
  }
}
