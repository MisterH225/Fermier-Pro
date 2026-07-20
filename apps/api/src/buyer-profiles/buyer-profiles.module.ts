import { Module } from "@nestjs/common";
import { AppEventsModule } from "../app-events/app-events.module";
import { AuthModule } from "../auth/auth.module";
import { WalletModule } from "../wallet/wallet.module";
import { PrismaModule } from "../prisma/prisma.module";
import { BuyerProfilesController } from "./buyer-profiles.controller";
import { BuyerProfilesService } from "./buyer-profiles.service";

@Module({
  imports: [PrismaModule, AuthModule, WalletModule, AppEventsModule],
  controllers: [BuyerProfilesController],
  providers: [BuyerProfilesService],
  exports: [BuyerProfilesService]
})
export class BuyerProfilesModule {}
