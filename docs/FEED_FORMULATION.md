# Moteur de formulation d’aliments (`feed_composition`)

Module **interne** Nest (`apps/api/src/feed-formulation`) — aucun endpoint mobile.
Appelé par J3/J4. Gardé par le flag plateforme `feed_composition` (prérequis : `mills`).

## Livré (J2)

1. **`FeedRequirementProfile`** — besoins nutritionnels par `ProductionStage`
   (seed indicatif INRAE/NRC, **à valider par un nutritionniste**).
2. CRUD superadmin ` /api/v1/admin/feed-requirement-profiles `.
3. **`FeedFormulationService`** — formulation au moindre coût + substitution.

## Solveur

**Choix : (a) `javascript-lp-solver`** derrière `SolverPort`.

| | LP (retenu) | Heuristique maison |
|--|-------------|-------------------|
| Optimum | Garanti (simplex) | Non |
| Sécurité nutritionnelle | Contraintes dures | Risque de ration « presque » valide |
| ~10–20 intrants | Coût négligeable | Complexité de maintenance |

Une heuristique serait plus transparente mais plus fragile pour min/max + stocks ;
l’interface `SolverPort` permet de changer sans toucher au moteur.

## Anti-gras (fattening / finishing)

- Plafond `maxMetabolizableEnergyKcal`
- Ratio `minLysinePerMcal` (g lysine / Mcal EM) =
  `10000 × lysinePct / metabolizableEnergyKcal`

## Cas infaisable

`feasible: false`, `ration: []`, diagnostic dans `infeasibilityReasons`
(nutriment + type d’intrant manquant). Jamais de ration hors bornes présentée comme valide.
