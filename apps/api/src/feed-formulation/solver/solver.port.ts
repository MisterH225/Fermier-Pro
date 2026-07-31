/**
 * Port d'abstraction du solveur de programmation linéaire.
 * Permet de remplacer javascript-lp-solver sans toucher au moteur.
 */

export type LinearConstraintBound = {
  min?: number;
  max?: number;
  equal?: number;
};

export type LinearProgramModel = {
  /** Nom de la variable objectif (ex. « cost »). */
  objective: string;
  sense: "min" | "max";
  constraints: Record<string, LinearConstraintBound>;
  /** variableId → { [coeffName]: number } — doit inclure la clé objective. */
  variables: Record<string, Record<string, number>>;
};

export type LinearProgramSolution = {
  feasible: boolean;
  /** Valeur de l'objectif si faisable. */
  objectiveValue: number;
  /** Affectations des variables (0 si absentes). */
  values: Record<string, number>;
};

export interface SolverPort {
  solve(model: LinearProgramModel): LinearProgramSolution;
}

export const SOLVER_PORT = Symbol("SOLVER_PORT");
