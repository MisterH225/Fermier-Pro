declare module "javascript-lp-solver" {
  export type LpConstraint = {
    min?: number;
    max?: number;
    equal?: number;
  };

  export type LpModel = {
    optimize: string;
    opType: "min" | "max";
    constraints: Record<string, LpConstraint>;
    variables: Record<string, Record<string, number>>;
    ints?: Record<string, number>;
  };

  export type LpSolveResult = {
    feasible: boolean;
    result: number;
    bounded?: boolean;
    [variable: string]: number | boolean | undefined;
  };

  export function Solve(model: LpModel): LpSolveResult;

  const solver: { Solve: typeof Solve };
  export default solver;
}
