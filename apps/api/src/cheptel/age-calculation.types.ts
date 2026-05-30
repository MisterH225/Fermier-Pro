export type AnimalAgeInput = {
  birthDate: Date | null;
  ageWeeksAtEntry: number | null;
  entryDate: Date | null;
};

export type PenAgeData = {
  averageAgeWeeksCalculated: number | null;
  averageAgeWeeksManual: number | null;
  animalsWithAgeCount: number;
  animalsWithoutAgeCount: number;
  displayAgeWeeks: number | null;
  isManual: boolean;
};
