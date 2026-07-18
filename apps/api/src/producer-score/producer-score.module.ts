import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ProducerScoreController } from "./producer-score.controller";
import { ProducerScoreMetricsService } from "./producer-score-metrics.service";
import { ProducerScoreService } from "./producer-score.service";

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [ProducerScoreController],
  providers: [ProducerScoreService, ProducerScoreMetricsService],
  exports: [ProducerScoreService, ProducerScoreMetricsService]
})
export class ProducerScoreModule {}
