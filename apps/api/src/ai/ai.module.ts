import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { AiController } from "./ai.controller";
import { AiDataAggregatorService } from "./ai-data-aggregator.service";
import { AiGeminiService } from "./ai-gemini.service";
import { AiPromptBuilderService } from "./ai-prompt-builder.service";
import { AiResponseParserService } from "./ai-response-parser.service";
import { AiService } from "./ai.service";

@Module({
  imports: [AuthModule, CommonModule, FeatureFlagsModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiDataAggregatorService,
    AiPromptBuilderService,
    AiGeminiService,
    AiResponseParserService
  ],
  exports: [AiService, AiGeminiService]
})
export class AiModule {}
