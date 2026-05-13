import type { FarmDetailMenuKeys } from "../../lib/menuVisibility";
import type { RootStackParamList } from "../../types/navigation";

/** Variante visuelle partagée entre les cartes du détail ferme. */
export type FarmDetailMenuPreset =
  | "cheptel"
  | "tasks"
  | "chat"
  | "vet"
  | "finance"
  | "housing"
  | "market"
  | "team"
  | "feed";

type FarmDetailNavTarget =
  | {
      screen: "FarmLivestock";
      params: RootStackParamList["FarmLivestock"];
    }
  | {
      screen: "FarmTasks";
      params: RootStackParamList["FarmTasks"];
    }
  | {
      screen: "FarmVetConsultations";
      params: RootStackParamList["FarmVetConsultations"];
    }
  | {
      screen: "FarmFinance";
      params: RootStackParamList["FarmFinance"];
    }
  | {
      screen: "FarmBarns";
      params: RootStackParamList["FarmBarns"];
    }
  | {
      screen: "CreateMarketplaceListing";
      params: RootStackParamList["CreateMarketplaceListing"];
    }
  | {
      screen: "FarmMembers";
      params: RootStackParamList["FarmMembers"];
    }
  | {
      screen: "FarmFeedStock";
      params: RootStackParamList["FarmFeedStock"];
    };

export type FarmDetailMenuNavigateRow = {
  kind: "navigate";
  preset: FarmDetailMenuPreset;
  visible: boolean;
  title: string;
  subtitle: string;
} & FarmDetailNavTarget;

export type FarmDetailMenuChatRow = {
  kind: "farmChat";
  preset: "chat";
  visible: boolean;
  title: string;
  subtitleIdle: string;
  subtitlePending: string;
};

export type FarmDetailMenuRow = FarmDetailMenuNavigateRow | FarmDetailMenuChatRow;

/**
 * Entrées du menu détail ferme : ordre produit + visibilité (flags + scopes via `menu`).
 * Point d’extension pour la modularisation mobile (`features/*`).
 */
export function buildFarmDetailMenuItems(args: {
  menu: FarmDetailMenuKeys;
  farmId: string;
  farmName: string;
  effectiveScopes?: string[];
}): FarmDetailMenuRow[] {
  const { menu, farmId, farmName, effectiveScopes } = args;

  const rows: FarmDetailMenuRow[] = [
    {
      kind: "navigate",
      preset: "cheptel",
      visible: menu.livestock,
      title: "Voir le cheptel",
      subtitle: "Animaux et bandes",
      screen: "FarmLivestock",
      params: { farmId, farmName }
    },
    {
      kind: "farmChat",
      preset: "chat",
      visible: menu.chat,
      title: "Salon de la ferme",
      subtitleIdle: "Fil de discussion lié à cette exploitation",
      subtitlePending: "Ouverture…"
    },
    {
      kind: "navigate",
      preset: "tasks",
      visible: menu.tasks,
      title: "Tâches terrain",
      subtitle: "Journal technicien",
      screen: "FarmTasks",
      params: { farmId, farmName }
    },
    {
      kind: "navigate",
      preset: "vet",
      visible: menu.vetConsultations,
      title: "Suivi vétérinaire",
      subtitle: "Consultations et téléchargements",
      screen: "FarmVetConsultations",
      params: { farmId, farmName }
    },
    {
      kind: "navigate",
      preset: "finance",
      visible: menu.finance,
      title: "Finance",
      subtitle: "Coûts et marges",
      screen: "FarmFinance",
      params: { farmId, farmName }
    },
    {
      kind: "navigate",
      preset: "housing",
      visible: menu.housing,
      title: "Loges et parcours",
      subtitle: "Hébergement et chemins",
      screen: "FarmBarns",
      params: { farmId, farmName }
    },
    {
      kind: "navigate",
      preset: "market",
      visible: menu.marketplace,
      title: "Annonce sur le marché",
      subtitle: "Créer une annonce liée à cette ferme",
      screen: "CreateMarketplaceListing",
      params: { farmId }
    },
    {
      kind: "navigate",
      preset: "team",
      visible: true,
      title: "Équipe et invitations",
      subtitle: "Membres, rôles et liens d'invitation",
      screen: "FarmMembers",
      params: { farmId, farmName, effectiveScopes }
    },
    {
      kind: "navigate",
      preset: "feed",
      visible: menu.feedStock,
      title: "Nutrition et stock",
      subtitle: "Aliments achetés, stock restant",
      screen: "FarmFeedStock",
      params: { farmId, farmName }
    }
  ];

  return rows;
}
