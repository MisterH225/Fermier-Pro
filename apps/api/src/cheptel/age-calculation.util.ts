import type { AnimalAgeInput, PenAgeData } from "./age-calculation.types";

const MS_DAY = 86_400_000;

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Âge actuel en semaines entières ; `null` si données insuffisantes. */
export function calculateAnimalAgeWeeks(
  animal: AnimalAgeInput,
  referenceDate: Date = new Date()
): number | null {
  const refDay = startOfUtcDay(referenceDate);

  if (animal.birthDate) {
    const birthDay = startOfUtcDay(animal.birthDate);
    const days = Math.floor((refDay - birthDay) / MS_DAY);
    if (days < 0) {
      return null;
    }
    return Math.floor(days / 7);
  }

  if (
    animal.ageWeeksAtEntry != null &&
    animal.entryDate != null &&
    Number.isFinite(animal.ageWeeksAtEntry)
  ) {
    const entryDay = startOfUtcDay(animal.entryDate);
    const days = Math.floor((refDay - entryDay) / MS_DAY);
    if (days < 0) {
      return null;
    }
    return animal.ageWeeksAtEntry + Math.floor(days / 7);
  }

  return null;
}

export function buildPenAgeData(
  animals: AnimalAgeInput[],
  averageAgeWeeksManual: number | null,
  referenceDate: Date = new Date()
): PenAgeData {
  const ages: number[] = [];
  let animalsWithoutAgeCount = 0;

  for (const animal of animals) {
    const age = calculateAnimalAgeWeeks(animal, referenceDate);
    if (age == null) {
      animalsWithoutAgeCount += 1;
    } else {
      ages.push(age);
    }
  }

  const averageAgeWeeksCalculated =
    ages.length === 0
      ? null
      : Math.round(ages.reduce((sum, w) => sum + w, 0) / ages.length);

  const hasCalculated = averageAgeWeeksCalculated != null;
  const displayAgeWeeks = hasCalculated
    ? averageAgeWeeksCalculated
    : averageAgeWeeksManual;
  const isManual = !hasCalculated && averageAgeWeeksManual != null;

  return {
    averageAgeWeeksCalculated,
    averageAgeWeeksManual,
    animalsWithAgeCount: ages.length,
    animalsWithoutAgeCount,
    displayAgeWeeks,
    isManual
  };
}
