import { Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import type { User } from "@prisma/client";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../../auth/guards/supabase-jwt.guard";
import { RequirePlatformModule } from "../../feature-flags/require-platform-module.decorator";
import { PlatformModuleEnabledGuard } from "../../feature-flags/platform-module-enabled.guard";
import { ReceiptService } from "./receipt.service";

@Controller("marketplace")
@RequirePlatformModule("marketplace")
@UseGuards(SupabaseJwtGuard, PlatformModuleEnabledGuard)
export class ReceiptController {
  constructor(private readonly receipts: ReceiptService) {}

  @Get("transactions/:transactionId/receipt")
  getTransactionReceipt(
    @CurrentUser() user: User,
    @Param("transactionId") transactionId: string
  ) {
    return this.receipts.getReceiptForTransaction(user, transactionId);
  }

  @Post("transactions/:transactionId/receipt/generate")
  regenerateTransactionReceipt(
    @CurrentUser() user: User,
    @Param("transactionId") transactionId: string
  ) {
    return this.receipts.regenerateReceipt(user, transactionId);
  }

  @Get("transactions/:transactionId/receipt/pdf")
  async receiptPdf(
    @CurrentUser() user: User,
    @Param("transactionId") transactionId: string,
    @Res() res: Response
  ) {
    const { buffer, filename } =
      await this.receipts.buildReceiptPdfForTransaction(user, transactionId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get("receipts/:receiptId/download")
  downloadReceipt(
    @CurrentUser() user: User,
    @Param("receiptId") receiptId: string
  ) {
    return this.receipts.getDownloadUrl(user, receiptId);
  }
}
