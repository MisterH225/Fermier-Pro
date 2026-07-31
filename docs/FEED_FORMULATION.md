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

## Taux d’incorporation fixes (prémélanges)

Le solveur n’« voit » pas les vitamines / oligo-éléments : CMV, sel (et parfois
acides aminés de synthèse) s’incorporent à un **taux prescrit par stade**, pas
via l’optimisation.

1. **`FeedIngredient.isPremix`** — marque les additifs à taux fixe (hors LP).
2. **`FeedRequirementProfile.fixedInclusions`** — JSON
   `[{ feedIngredientId, inclusionPct }]` (ex. CMV 0,5 %, sel 0,3 % en engraissement).
3. **Solveur en deux temps** :
   - pose les taux fixes (Σ % de la masse totale) ;
   - optimise les intrants **variables** sur la masse restante `(100 % − Σ)` ;
   - les apports nutritionnels des prémélanges (**Ca/P du CMV** notamment)
     **comptent dans le bilan** — sinon le LP sur-ajoute du phosphate.
4. Si Σ taux fixes **> 5 %** → avertissement (probable erreur de saisie admin),
   sans bloquer. Si Σ ≥ 100 % → infaisable.

CRUD superadmin : même API profils (`fixedInclusions`) + flag `isPremix` sur
les intrants. Seed indicatif — **à valider par un nutritionniste**.

## Anti-gras (fattening / finishing)

- Plafond `maxMetabolizableEnergyKcal`
- Ratio `minLysinePerMcal` (g lysine / Mcal EM) =
  `10000 × lysinePct / metabolizableEnergyKcal`

## Cas infaisable

`feasible: false`, `ration: []`, diagnostic dans `infeasibilityReasons`
(nutriment + type d’intrant manquant). Jamais de ration hors bornes présentée comme valide.

## Agent + mode dégradé (J3)

| Endpoint | Rôle |
|----------|------|
| `POST /feed-composition/assist` | Agent Gemini (function calling → même moteur) |
| `POST /feed-composition/formulate` | Mode sans IA (même résultats) |
| `POST /feed-composition/explain` | Explication structurée (Gemini, sans tools) + cache |
| `POST /feed-composition/compositions` | Enregistrer une composition |
| `…/request-vet-review` / `…/vet-review` | Validation véto associé |

### Explication ration (`POST /explain`)

L’IA (Gemini, **pas** Anthropic) commente des **données déjà calculées** :
besoins du stade, profil obtenu, intrants + rôles (`FeedIngredient.category`).
Aucun chiffre inventé (rejet → fallback factuel). Cache dans
`SavedComposition.explanation` (empreinte ration) — régénéré si la ration change.

Réutilise la config Gemini existante : `GEMINI_API_KEY` (serveur only),
`GEMINI_MODEL` (défaut `gemini-2.5-flash-lite`), `GEMINI_QUOTA_COOLDOWN_MS`.
Max **3** itérations tool-use / requête. Si Gemini indisponible → `503 AI_UNAVAILABLE`
(fallback mobile vers `/formulate`).

## Revue vétérinaire (discussion)

À l’envoi en validation (`request-vet-review`) :

1. Ouvre une **`VetConsultation`** (`status=open`, subject « Validation composition — [stade] »,
   `primaryVetUserId` = véto associé) — historique ferme / stats activité.
2. Ouvre (ou réutilise) une **`ChatRoom`** `kind=feed_composition` ancrée
   `savedCompositionId` + `vetConsultationId`, membres = producteur + véto.
3. Poster une **carte JSON** `_type=feed_composition_card` (intrants, coûts, nutrition).

| Action | Effet |
|--------|--------|
| Commentaires | `ChatMessage` classiques |
| Ajustement véto | `POST …/propose-adjustment` → `recomputeWithSubstitution` (moteur J2) → nouvelle carte |
| Valider | `SavedComposition → validated` + consultation `resolved` + `closedAt` |
| Demander ajustements | reste `vet_review`, consultation reste `open` |
| Producteur applique | `POST …/apply-adjustment` (messageId de la carte) |

Choix consultation « closed » : l’enum existant utilise **`resolved`** (+ `closedAt`) —
pas de nouvelle valeur `closed`.
