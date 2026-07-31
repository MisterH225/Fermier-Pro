import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { SaveCompositionDto } from "./feed-composition.dto";

describe("SaveCompositionDto", () => {
  const base = {
    farmId: "farm-1",
    stage: "growing",
    source: "manual",
    inputParams: { animalCount: 10, durationDays: 30 },
    totalCostXof: 12000,
    ration: [
      {
        feedIngredientId: "ing-1",
        canonicalName: "Maïs",
        quantityKg: 70,
        proportionPct: 70,
        costContribution: 3500
      },
      {
        feedIngredientId: "ing-2",
        canonicalName: "Son de blé",
        quantityKg: 30,
        proportionPct: 30,
        costContribution: 900
      }
    ]
  };

  it("accepte ration comme tableau de lignes (payload mobile)", () => {
    const dto = plainToInstance(SaveCompositionDto, base);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true
    });
    expect(errors).toEqual([]);
    expect(Array.isArray(dto.ration)).toBe(true);
    expect(dto.ration).toHaveLength(2);
  });

  it("rejette ration non-tableau (ancien @IsObject)", () => {
    const dto = plainToInstance(SaveCompositionDto, {
      ...base,
      ration: { lines: base.ration }
    });
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true
    });
    expect(errors.some((e) => e.property === "ration")).toBe(true);
  });
});
