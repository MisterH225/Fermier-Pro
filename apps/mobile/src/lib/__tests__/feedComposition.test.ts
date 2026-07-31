import { isFeedCompositionModuleActive } from "../feedComposition";
import type { PlatformModuleDto } from "../api/config";
import {
  buildInfeasibilityMessage,
  isAiUnavailableError,
  respectsLeanPorkGoal,
  stageLabelFr
} from "../feedCompositionFormat";
import type { FeedFormulateResultDto } from "../api/feed-composition";
import { ApiError } from "../api/http";

function mod(
  moduleId: PlatformModuleDto["moduleId"],
  isActive: boolean
): PlatformModuleDto {
  return {
    moduleId,
    moduleName: moduleId,
    icon: null,
    isActive,
    canDisable: true,
    userMessageFr: null,
    userMessageEn: null,
    scheduledReactivation: null
  };
}

const feasible: FeedFormulateResultDto = {
  feasible: true,
  ration: [
    {
      feedIngredientId: "corn",
      canonicalName: "Maïs",
      quantityKg: 70,
      proportionPct: 70,
      costContribution: 14000
    }
  ],
  totalFeedKg: 100,
  dailyIntakeKg: 1.5,
  totalCostXof: 20000,
  costPerKg: 200,
  nutritionResult: null,
  deviations: [{ nutrient: "EM", target: "≤ 3200", actual: 3100, withinBounds: true }],
  warnings: [],
  infeasibilityReasons: []
};

describe("isFeedCompositionModuleActive", () => {
  it("flag OFF → false", () => {
    expect(
      isFeedCompositionModuleActive([
        mod("mills", true),
        mod("feed_composition", false)
      ])
    ).toBe(false);
  });

  it("flag ON → true", () => {
    expect(
      isFeedCompositionModuleActive([mod("feed_composition", true)])
    ).toBe(true);
  });

  it("modules absents → false", () => {
    expect(isFeedCompositionModuleActive(undefined)).toBe(false);
  });
});

describe("feedCompositionFormat", () => {
  it("labels stade FR", () => {
    expect(stageLabelFr("fattening")).toBe("Engraissement");
  });

  it("message infaisable clair", () => {
    const msg = buildInfeasibilityMessage(["protéine trop basse"]);
    expect(msg).toMatch(/ne suffisent pas/i);
    expect(msg).toMatch(/aliment du commerce/i);
  });

  it("porc sans graisse respecté en finition", () => {
    expect(respectsLeanPorkGoal(feasible, "finishing")).toBe(true);
    expect(respectsLeanPorkGoal(feasible, "growing")).toBe(false);
  });

  it("détecte AI_UNAVAILABLE", () => {
    expect(isAiUnavailableError(new ApiError("down", 503, "AI_UNAVAILABLE"))).toBe(
      true
    );
    expect(isAiUnavailableError(new Error("autre"))).toBe(false);
  });
});
