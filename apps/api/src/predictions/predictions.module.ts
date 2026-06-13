import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { FeedPurchaseForecastService } from "./feed-purchase-forecast.service";
import { PredictionDataCollectorService } from "./prediction-data-collector.service";
import { PredictiveAgentService } from "./predictive-agent.service";
import { PredictionsController } from "./predictions.controller";
import { PredictionsCronService } from "./predictions-cron.service";
import { PredictionsService } from "./predictions.service";

@Module({
  imports: [AuthModule, CommonModule, FeatureFlagsModule, AiModule],
  controllers: [PredictionsController],
  providers: [
    PredictionDataCollectorService,
    PredictiveAgentService,
    FeedPurchaseForecastService,
    PredictionsService,
    PredictionsCronService
  ],
  exports: [PredictionsService]
})
export class PredictionsModule {}
