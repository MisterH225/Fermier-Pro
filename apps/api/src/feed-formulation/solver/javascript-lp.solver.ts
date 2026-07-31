import { Injectable } from "@nestjs/common";
import solver from "javascript-lp-solver";
import type {
  LinearProgramModel,
  LinearProgramSolution,
  SolverPort
} from "./solver.port";

/**
 * Adaptateur javascript-lp-solver (simplex).
 * Choix retenu vs heuristique maison : optimum garanti, dépendance légère,
 * ~10–20 variables = coût négligeable ; une heuristique correcte sous
 * contraintes min/max + disponibilités serait plus fragile et moins sûre
 * pour un usage nutritionnel.
 */
@Injectable()
export class JavascriptLpSolver implements SolverPort {
  solve(model: LinearProgramModel): LinearProgramSolution {
    const lpModel = {
      optimize: model.objective,
      opType: model.sense,
      constraints: model.constraints,
      variables: model.variables
    };
    const raw = solver.Solve(lpModel);
    const values: Record<string, number> = {};
    for (const key of Object.keys(model.variables)) {
      const v = raw[key];
      values[key] = typeof v === "number" && Number.isFinite(v) ? v : 0;
    }
    return {
      feasible: Boolean(raw.feasible),
      objectiveValue:
        typeof raw.result === "number" && Number.isFinite(raw.result)
          ? raw.result
          : Number.POSITIVE_INFINITY,
      values
    };
  }
}
