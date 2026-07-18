import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ProducerScoreModule } from "../producer-score/producer-score.module";
import { TrustScoreAdminController } from "./trust-score-admin.controller";
import { TrustScoreController } from "./trust-score.controller";
import { TrustScoreMetricsService } from "./trust-score-metrics.service";
import { TrustScoreService } from "./trust-score.service";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    forwardRef(() => ProducerScoreModule)
  ],
  controllers: [TrustScoreController, TrustScoreAdminController],
  providers: [TrustScoreService, TrustScoreMetricsService],
  exports: [TrustScoreService]
})
export class TrustScoreModule {}
