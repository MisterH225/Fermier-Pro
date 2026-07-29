import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SubscriptionLimitsService } from "./subscription-limits.service";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [SubscriptionLimitsService],
  exports: [SubscriptionLimitsService]
})
export class SubscriptionLimitsModule {}
