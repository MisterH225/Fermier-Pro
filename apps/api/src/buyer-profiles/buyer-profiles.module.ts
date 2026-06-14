import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BuyerWalletModule } from "../buyer-wallet/buyer-wallet.module";
import { PrismaModule } from "../prisma/prisma.module";
import { BuyerProfilesController } from "./buyer-profiles.controller";
import { BuyerProfilesService } from "./buyer-profiles.service";

@Module({
  imports: [PrismaModule, AuthModule, BuyerWalletModule],
  controllers: [BuyerProfilesController],
  providers: [BuyerProfilesService],
  exports: [BuyerProfilesService]
})
export class BuyerProfilesModule {}
