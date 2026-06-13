import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  MarketplaceTransactionStatus,
  ReceiptGenerationStatus
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ReceiptService } from "./receipt.service";

@Injectable()
export class ReceiptCronService {
  private readonly log = new Logger(ReceiptCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly receipts: ReceiptService
  ) {}

  /** Régénère les reçus en échec ou en attente sur transactions clôturées. */
  @Cron("30 */6 * * *")
  async retryPendingReceipts(): Promise<void> {
    try {
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 30);

      const rows = await this.prisma.marketplaceTransaction.findMany({
        where: {
          status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
          closedAt: { gte: since },
          receiptGenerationStatus: {
            in: [
              ReceiptGenerationStatus.pending,
              ReceiptGenerationStatus.failed
            ]
          },
          receipt: null
        },
        select: { id: true },
        take: 15,
        orderBy: { closedAt: "asc" }
      });

      let ok = 0;
      for (const row of rows) {
        const res = await this.receipts.generateReceipt(row.id);
        if (res?.receiptNumber) {
          ok += 1;
        }
      }
      if (ok > 0) {
        this.log.log(`Receipt cron: ${ok}/${rows.length} reçu(s) généré(s)`);
      }
    } catch (e) {
      this.log.warn(`receipt cron: ${(e as Error).message}`);
    }
  }
}
