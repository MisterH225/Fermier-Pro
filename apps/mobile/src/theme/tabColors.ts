/**
 * Palette unifiée des sous-onglets (SubMenuTabs / TabSelector).
 * Identique sur toute l'app, tous modules, tous profils.
 */
export const tabColors = {
  /** Onglet actif : terracotta désaturé */
  ACTIVE: "#B5654A",
  /** Onglet inactif — position paire */
  INACTIVE_1: "#3D6B73",
  /** Onglet inactif — position impaire */
  INACTIVE_2: "#7A8B6F",
  /** Texte inactif neutre */
  INACTIVE_TEXT: "#757575"
} as const;

/** Couleur d'accent inactif selon la position (rotation bleu pétrole / vert sauge). */
export function getInactiveAccentColor(index: number): string {
  return index % 2 === 0 ? tabColors.INACTIVE_1 : tabColors.INACTIVE_2;
}

/** Couleur du libellé selon l'état actif et la position. */
export function getTabLabelColor(active: boolean, index: number): string {
  if (active) {
    return tabColors.ACTIVE;
  }
  return tabColors.INACTIVE_TEXT;
}
