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
import {
  WalletFeeTransactionType,
  WithdrawalRequestStatus,
  type User
} from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import {
  RejectWithdrawalDto,
  UpdateWalletFeeConfigBodyDto
} from "./dto/wallet-admin.dto";
import { PlatformAccountService } from "./platform-account.service";
import { WalletFeeService } from "./wallet-fee.service";
import { WithdrawalOrchestratorService } from "./withdrawal-orchestrator.service";

@Controller("admin/wallet")
@UseGuards(SupabaseJwtGuard, SuperAdminGuard)
export class AdminWalletController {
  constructor(
    private readonly fees: WalletFeeService,
    private readonly withdrawals: WithdrawalOrchestratorService,
    private readonly platformAccount: PlatformAccountService
  ) {}

  @Get("fees")
  listFees() {
    return this.fees.listConfigs();
  }

  @Patch("fees/:transactionType")
  updateFee(
    @Param("transactionType") transactionType: WalletFeeTransactionType,
    @Body() dto: UpdateWalletFeeConfigBodyDto
  ) {
    return this.fees.updateConfig(transactionType, dto);
  }

  @Get("account")
  account() {
    return this.platformAccount.getView();
  }

  @Post("account/reconcile")
  reconcile() {
    return this.platformAccount.reconcile();
  }

  @Get("withdrawals")
  listWithdrawals(@Query("status") status?: WithdrawalRequestStatus) {
    return this.withdrawals.listForAdmin(status);
  }

  @Post("withdrawals/:id/approve")
  approveWithdrawal(@CurrentUser() admin: User, @Param("id") id: string) {
    return this.withdrawals.approveWithdrawal(admin.id, id);
  }

  @Post("withdrawals/:id/reject")
  rejectWithdrawal(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: RejectWithdrawalDto
  ) {
    return this.withdrawals.rejectWithdrawal(admin.id, id, dto.reason);
  }
}
