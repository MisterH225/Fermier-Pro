import type { ExtendedNavMenuId } from "./types";

export const PRODUCER_EXTENDED_MENU_IDS = [
  "team",
  "communityFeed",
  "nutrition",
  "gestation",
  "tasks",
  "reports",
  "messages",
  "settings"
] as const satisfies readonly ExtendedNavMenuId[];

export type ProducerExtendedMenuId = (typeof PRODUCER_EXTENDED_MENU_IDS)[number];

/**
 * Identifiants du menu étendu producteur (ordre d’affichage).
 * `market` n’y figure plus : il est un onglet principal.
 * `communityFeed` y figure : Com a quitté la barre principale.
 */
export function producerExtendedMenuIds(): readonly ProducerExtendedMenuId[] {
  return PRODUCER_EXTENDED_MENU_IDS;
}
