import { Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { AiGeminiService } from "../ai/ai-gemini.service";
import { ProfitabilityEngine } from "./profitability.engine";
import type {
  BatchProfitabilityResult,
  FarmProfitabilityDashboardDto,
  FarmProfitabilityResult,
  ProfitabilityInsightsResult,
  ProfitabilityPeriodKey
} from "./profitability.types";

@Injectable()
export class ProfitabilityService {
  constructor(
    private readonly farmAccess: FarmAccessService,
    private readonly engine: ProfitabilityEngine,
    private readonly gemini: AiGeminiService
  ) {}

  async getFarmProfitability(
    user: User,
    farmId: string,
    period: ProfitabilityPeriodKey,
    custom?: { start: string; end: string }
  ): Promise<FarmProfitabilityResult> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.engine.calculateFarmProfitability(farmId, period, custom);
  }

  async getDashboard(
    user: User,
    farmId: string,
    period: ProfitabilityPeriodKey
  ): Promise<FarmProfitabilityDashboardDto> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.engine.getDashboardData(farmId, period);
  }

  async getAllBatches(
    user: User,
    farmId: string
  ): Promise<BatchProfitabilityResult[]> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.engine.calculateAllBatches(farmId);
  }

  async getBatch(
    user: User,
    farmId: string,
    batchId: string
  ): Promise<BatchProfitabilityResult> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.engine.calculateBatchProfitability(farmId, batchId);
  }

  async recalculate(user: User, farmId: string): Promise<{ ok: true }> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    this.engine.scheduleRecalculate(farmId);
    return { ok: true };
  }

  async getInsights(
    user: User,
    farmId: string,
    period: ProfitabilityPeriodKey = "current_month"
  ): Promise<ProfitabilityInsightsResult> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const [farm, batches] = await Promise.all([
      this.engine.calculateFarmProfitability(farmId, period),
      this.engine.calculateAllBatches(farmId)
    ]);

    if (farm.dataQuality === "insufficient") {
      return { insights: [], generatedAt: null, available: false };
    }

    try {
      const prompt = `Analyse ces données de rentabilité d'une ferme porcine :
marge_brute=${JSON.stringify(farm.realized.grossMargin)}, marge_nette=${JSON.stringify(farm.realized.netMargin)}, cout_revient_kg=${JSON.stringify(farm.realized.costPerKg)}, ic_par_bande=${JSON.stringify(batches.map((b) => ({ name: b.batchName, ic: b.realized.icActual })))}, comparaison_marche=${JSON.stringify({ market: farm.marketPricePerKg, breakeven: farm.realized.breakevenPricePerKg })}.
Identifie les 3 principaux leviers pour améliorer la rentabilité. Sois concret et actionnable.
Réponds UNIQUEMENT en JSON valide : { "insights": [{ "title": string, "observation": string, "recommendation": string, "potential_impact": string, "priority": "high" | "medium" | "low" }] }`;

      const raw = await this.gemini.generateText(prompt);
      if (!raw) {
        return { insights: [], generatedAt: null, available: false };
      }
      const parsed = JSON.parse(raw) as {
        insights?: Array<{
          title: string;
          observation: string;
          recommendation: string;
          potential_impact: string;
          priority: "high" | "medium" | "low";
        }>;
      };
      const insights = (parsed.insights ?? []).slice(0, 3).map((i) => ({
        title: i.title,
        observation: i.observation,
        recommendation: i.recommendation,
        potentialImpact: i.potential_impact,
        priority: i.priority
      }));
      return {
        insights,
        generatedAt: new Date().toISOString(),
        available: insights.length > 0
      };
    } catch {
      return { insights: [], generatedAt: null, available: false };
    }
  }
}
