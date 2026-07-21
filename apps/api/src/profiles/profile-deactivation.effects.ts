import type { ProfileType } from "@prisma/client";
import type { ProfileDeactivationEffect } from "./profile-deactivation.types";

/** Effets affichés avant confirmation — indépendants des blocages runtime. */
export function buildDeactivationEffects(
  type: ProfileType
): ProfileDeactivationEffect {
  switch (type) {
    case "producer":
      return {
        willHide: [
          "Le profil producteur disparaît du sélecteur",
          "Les invitations en attente seront annulées"
        ],
        willKeep: [
          "Les fermes et l'historique sanitaire / financier",
          "Les animaux et lots déjà enregistrés"
        ]
      };
    case "buyer":
      return {
        willHide: [
          "Impossible de faire de nouvelles offres marketplace",
          "Le profil acheteur disparaît du sélecteur"
        ],
        willKeep: [
          "Les commandes et transactions passées",
          "La Météo acheteur et l'historique"
        ]
      };
    case "merchant":
      return {
        willHide: [
          "Boutique et produits masqués du marketplace",
          "Le profil commerçant disparaît du sélecteur"
        ],
        willKeep: [
          "Boutique et catalogue non supprimés",
          "L'historique des commandes"
        ]
      };
    case "veterinarian":
      return {
        willHide: [
          "Retrait des annuaires et de la recherche vétérinaire",
          "Disponibilité forcée à indisponible"
        ],
        willKeep: [
          "Consultations et avis passés",
          "Badges Santé vérifiée déjà émis"
        ]
      };
    case "technician":
      return {
        willHide: [
          "Retrait des annuaires technicien",
          "Le profil technicien disparaît du sélecteur"
        ],
        willKeep: [
          "L'historique des tâches déjà réalisées",
          "Les données de profil enregistrées"
        ]
      };
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function formatCountMessage(
  count: number,
  singular: string,
  plural: string,
  suffix: string
): string {
  const label = count <= 1 ? singular : plural;
  return `${count} ${label} ${suffix}`;
}
