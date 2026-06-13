import { Controller, Get, Param } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { ReceiptService } from "./receipt.service";

/** Endpoint public pour le QR code des reçus PDF marketplace. */
@Controller("verify")
@SkipThrottle()
export class ReceiptVerifyController {
  constructor(private readonly receipts: ReceiptService) {}

  @Get(":receiptNumber")
  verify(@Param("receiptNumber") receiptNumber: string) {
    return this.receipts.verifyReceiptPublic(receiptNumber);
  }
}
