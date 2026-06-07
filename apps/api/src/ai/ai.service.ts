import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { User } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { requiredScopesForAiModule } from "./ai-module-scopes";
import { AiDataAggregatorService } from "./ai-data-aggregator.service";
import { AiGeminiService } from "./ai-gemini.service";
import { AiPromptBuilderService } from "./ai-prompt-builder.service";
import { AiResponseParserService } from "./ai-response-parser.service";
import type { AiRecommendationsResponse } from "./ai.types";
import type { CreateAiRecommendationsDto } from "./dto/create-ai-recommendations.dto";

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly aggregator: AiDataAggregatorService,
    private readonly promptBuilder: AiPromptBuilderService,
    private readonly gemini: AiGeminiService,
    private readonly parser: AiResponseParserService
  ) {}

  async getRecommendations(
    user: User,
    dto: CreateAiRecommendationsDto
  ): Promise<AiRecommendationsResponse> {
    const { farmId, module } = dto;
    await this.farmAccess.requireFarmScopes(
      user.id,
      farmId,
      requiredScopesForAiModule(module)
    );

    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: { id: true }
    });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }

    const sufficient = await this.aggregator.hasSufficientData(farmId, module);
    if (!sufficient) {
      return {
        items: [],
        generatedAt: new Date().toISOString(),
        insufficient: true
      };
    }

    if (!this.gemini.isConfigured()) {
      return {
        items: [],
        generatedAt: new Date().toISOString(),
        unavailable: true
      };
    }

    const aggregated = await this.aggregator.aggregate(farmId, module);
    const prompt = this.promptBuilder.build(module, aggregated);
    const raw = await this.gemini.generateText(prompt);

    if (!raw) {
      return {
        items: [],
        generatedAt: new Date().toISOString(),
        unavailable: true
      };
    }

    const items = this.parser.parse(raw, module);
    if (!items.length) {
      this.logger.debug(`Aucun insight parsé pour module=${module} farm=${farmId}`);
    }

    return {
      items,
      generatedAt: new Date().toISOString()
    };
  }
}
