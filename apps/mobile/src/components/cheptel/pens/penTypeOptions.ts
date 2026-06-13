import type { PenCategoryKey } from "../../../lib/api";

export type PenTypeOption = {
  label: string;
  category: PenCategoryKey;
};

export const PEN_TYPE_OPTIONS: PenTypeOption[] = [
  { label: "Démarrage", category: "starter" },
  { label: "Croissance", category: "fattening" },
  { label: "Engraissement", category: "fattening" },
  { label: "Maternité", category: "maternity" },
  { label: "Mixte", category: "mixed" }
];

export function penTypeLabel(category: PenCategoryKey): string {
  return (
    PEN_TYPE_OPTIONS.find((o) => o.category === category)?.label ??
    PEN_TYPE_OPTIONS.find((o) => o.category === "mixed")!.label
  );
}
