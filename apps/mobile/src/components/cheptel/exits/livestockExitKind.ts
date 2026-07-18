/**
 * Miroir de l’enum Prisma `LivestockExitKind` (sale | mortality | slaughter | transfer).
 * Aucun verbe sans kind correspondant.
 */
export const LIVESTOCK_EXIT_KINDS = [
  "sale",
  "mortality",
  "slaughter",
  "transfer"
] as const;

export type LivestockExitKind = (typeof LIVESTOCK_EXIT_KINDS)[number];

/** Verbes utilisateur pour chaque kind (tous les kinds sont des gestes courants). */
export const LIVESTOCK_EXIT_VERB_KEYS: Record<
  LivestockExitKind,
  { labelKey: string; a11yKey: string }
> = {
  sale: {
    labelKey: "cheptel.exits.verbs.sell",
    a11yKey: "cheptel.exits.verbs.sellA11y"
  },
  mortality: {
    labelKey: "cheptel.exits.verbs.mortality",
    a11yKey: "cheptel.exits.verbs.mortalityA11y"
  },
  transfer: {
    labelKey: "cheptel.exits.verbs.transfer",
    a11yKey: "cheptel.exits.verbs.transferA11y"
  },
  slaughter: {
    labelKey: "cheptel.exits.verbs.slaughter",
    a11yKey: "cheptel.exits.verbs.slaughterA11y"
  }
};

/** Ordre d’affichage des verbes sur les fiches. */
export const LIVESTOCK_EXIT_VERB_ORDER: LivestockExitKind[] = [
  "sale",
  "mortality",
  "transfer",
  "slaughter"
];

/**
 * Mapping kind → statut animal du formulaire de sortie existant
 * (`ChangeStatusModal` / patch status). `sale` passe par SaleModal / chooser.
 */
export function animalStatusForExitKind(
  kind: Exclude<LivestockExitKind, "sale">
): "dead" | "exited" | "transferred" {
  switch (kind) {
    case "mortality":
      return "dead";
    case "slaughter":
      return "exited";
    case "transfer":
      return "transferred";
  }
}

export function isLivestockExitKind(value: string): value is LivestockExitKind {
  return (LIVESTOCK_EXIT_KINDS as readonly string[]).includes(value);
}
