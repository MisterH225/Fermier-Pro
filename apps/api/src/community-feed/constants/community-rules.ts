export type CommunityRuleSeverity = "low" | "medium" | "high";

export type CommunityRule = {
  id: string;
  label: string;
  description: string;
  severity: CommunityRuleSeverity;
  autoHandled?: boolean;
};

export const COMMUNITY_RULES: CommunityRule[] = [
  {
    id: "R001",
    label: "Respect",
    description: "Aucune insulte, moquerie ou attaque personnelle",
    severity: "high"
  },
  {
    id: "R002",
    label: "Véracité",
    description: "Ne pas partager de fausses informations délibérément",
    severity: "high"
  },
  {
    id: "R003",
    label: "Pertinence",
    description: "Rester dans le sujet de l'élevage porcin",
    severity: "low"
  },
  {
    id: "R004",
    label: "Vie privée",
    description:
      "Ne pas partager les informations personnelles d'autres utilisateurs",
    severity: "high"
  },
  {
    id: "R005",
    label: "Publicité",
    description: "Pas de contenu publicitaire ou commercial déguisé",
    severity: "medium"
  },
  {
    id: "R006",
    label: "Spam",
    description: "Pas de messages répétitifs ou hors contexte",
    severity: "medium"
  },
  {
    id: "R007",
    label: "Numéros de téléphone",
    description: "Partage de coordonnées interdit",
    severity: "medium",
    autoHandled: true
  }
];

export function findCommunityRule(id: string | null | undefined): CommunityRule | undefined {
  if (!id) {
    return undefined;
  }
  return COMMUNITY_RULES.find((r) => r.id === id);
}
