import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TrustScoreModule } from "../trust-score/trust-score.module";
import { CrossRatingsAdminController } from "./cross-ratings-admin.controller";
import { CrossRatingsController } from "./cross-ratings.controller";
import { CrossRatingsService } from "./cross-ratings.service";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    // Soft dependency — TrustScoreModule n'importe pas CrossRatings (pas de cycle).
    forwardRef(() => TrustScoreModule)
  ],
  controllers: [CrossRatingsController, CrossRatingsAdminController],
  providers: [CrossRatingsService],
  exports: [CrossRatingsService]
})
export class CrossRatingsModule {}
