import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { BuyerWalletService } from "./buyer-wallet.service";

@Controller("buyers/me/wallet")
@UseGuards(SupabaseJwtGuard)
export class BuyerWalletController {
  constructor(private readonly wallet: BuyerWalletService) {}

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
