import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { CommonModule } from "../common/common.module";
import { PredictionDataCollectorService } from "./prediction-data-collector.service";
import { PredictiveAgentService } from "./predictive-agent.service";
import { PredictionsController } from "./predictions.controller";
import { PredictionsCronService } from "./predictions-cron.service";
import { PredictionsService } from "./predictions.service";

@Module({
  imports: [CommonModule, AiModule],
  controllers: [PredictionsController],
  providers: [
    PredictionDataCollectorService,
    PredictiveAgentService,
    PredictionsService,
    PredictionsCronService
  ],
  exports: [PredictionsService]
})
export class PredictionsModule {}
