import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { BuyerWalletController } from "./buyer-wallet.controller";
import { BuyerWalletService } from "./buyer-wallet.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BuyerWalletController],
  providers: [BuyerWalletService],
  exports: [BuyerWalletService]
})
export class BuyerWalletModule {}
