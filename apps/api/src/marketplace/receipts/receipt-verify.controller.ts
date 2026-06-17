import { Controller, Get, Param } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ReceiptService } from "./receipt.service";

/** Endpoint public pour le QR code des reçus PDF marketplace. */
@Controller("verify")
@Throttle({ default: { limit: 20, ttl: 60_000 } }) // Limite l'énumération des numéros de reçu
export class ReceiptVerifyController {
  constructor(private readonly receipts: ReceiptService) {}

  @Get(":receiptNumber")
  verify(@Param("receiptNumber") receiptNumber: string) {
    return this.receipts.verifyReceiptPublic(receiptNumber);
  }
}
