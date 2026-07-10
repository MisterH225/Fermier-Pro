import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MobileMoneyModule } from "../marketplace/escrow/mobile-money.module";
import { PrismaModule } from "../prisma/prisma.module";
import { WalletModule } from "../wallet/wallet.module";
import { ProducerProfilesService } from "./producer-profiles.service";
import { ProducerSubscriptionBillingService } from "./producer-subscription-billing.service";
import { ProducerSubscriptionController } from "./producer-subscription.controller";
import { ProducerSubscriptionCronService } from "./producer-subscription.cron";
import { ProducerSubscriptionService } from "./producer-subscription.service";
import { ProducerTeamAccessService } from "./producer-team-access.service";

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule), WalletModule, MobileMoneyModule],
  controllers: [ProducerSubscriptionController],
  providers: [
    ProducerTeamAccessService,
    ProducerProfilesService,
    ProducerSubscriptionBillingService,
    ProducerSubscriptionService,
    ProducerSubscriptionCronService
  ],
  exports: [
    ProducerTeamAccessService,
    ProducerProfilesService,
    ProducerSubscriptionBillingService,
    ProducerSubscriptionService
  ]
})
export class ProducerSubscriptionModule {}
