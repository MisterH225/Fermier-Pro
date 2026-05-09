# Modes d’élevage flexibles & gestion des loges

Document de référence pour aligner le produit et le backend **Fermier Pro** sur les pratiques réelles du terrain (porcin en premier, extensible multi-espèces). À lire avec `PRODUCT_BLUEPRINT.md`.

## 1) Principes

- **Deux grands modes** : suivi **individuel** (chaque sujet identifié) et suivi par **bandes** (lots homogènes sans ID individuelle).
- **Mode hybride** : coexistence des deux (ex. truies individuelles + porcelets en bande) — cas **très fréquent** ; le système doit le supporter par **catégorie / stade**, pas seulement par une bascule globale binaire.
- **Réversibilité** : le choix à l’onboarding **n’est pas irréversible** ; le producteur peut migrer progressivement, activer l’hybride ou changer de méthode. Le backend doit prévoir **cohérence historique**, **conversion** (ex. bande → sujets individuels, fusion inverse) et **conservation des agrégats** pour les rapports.
- **UX terrain** : priorité à la simplicité, saisie minimale, gros CTA, workflows courts, résilience **faible connectivité** (aligné avec la roadmap offline partielle).

## 2) Mode 1 — Gestion individuelle

Objets métier principaux : **Animal** (déjà présent dans le schéma) avec identifiant stable (`publicId`, QR), **poids** (`AnimalWeight`), **santé** (`AnimalHealthEvent`, consultations véto), coûts (allocation sur animal ou rattachement analytique), reproduction (tables roadmap).

Le dashboard et les formulaires **mettent l’individu au centre** (courbes par sujet, historique, alertes ciblées).

## 3) Mode 2 — Gestion par bandes uniformes

Objet métier principal : **Bande** (`Batch` / `Lot`) — groupe homogène défini par critères métier (portée, tranche de poids, âge, stade, lot d’achat, etc.).

Chaque bande porte typiquement : identifiant, **effectif**, **poids moyen** (et optionnellement distribution), **âge moyen** ou cohorte, consommation agrégée, **santé collective**, historique et coûts **au niveau bande**.

Les écrans et agrégats **remplacent la granularité sujet** par **lot** (évolution collective, densité par loge, etc.).

## 4) Mode hybride (configuration par catégorie)

- Au niveau **ferme** : un mode global `individual` | `batch` | `hybrid` (champ Prisma `Farm.livestockMode`).
- En **hybride** : politiques par **catégorie de sujet** (truie, porcelet, post-sevrage, engraissement…) stockées dans `Farm.livestockCategoryPolicies` (JSON), ex. `{ "sow": "individual", "nursery": "batch" }`. Les clés et le référentiel catégories seront affinés (enum métier ou table `AnimalCategory` plus tard).
- **Workflows** à prévoir :
  - migration **bande → individus** (éclatement avec création d’`Animal` + lien vers l’historique de bande) ;
  - **fusion** de sujets en bande (avec traçabilité) ;
  - coexistence dans la **même loge** (effectif bande + sujets identifiés selon règles).

## 5) Onboarding

Lors de **création de ferme** (et futur assistant onboarding), le producteur choisit le **mode d’élevage** initial et, si hybride, une première version des politiques par catégorie.

L’API expose ces champs sur `POST /farms` (optionnels avec défaut `individual` pour rétrocompatibilité).

## 6) Loges & parc (bâtiments → zones → loges → compartiments)

Hiérarchie cible (tables à introduire progressivement) :

| Concept        | Rôle |
|----------------|------|
| `Barn`         | Bâtiment |
| `PenZone`      | Zone à l’intérieur d’un bâtiment (optionnel) |
| `Pen`          | Loge / enclos (unité d’affectation principale) |
| `PenCompartment` | Sous-découpage si besoin (nurserie, cases) |

Fonctionnalités cibles :

- **Visualisation** : occupation (vide / occupé), effectif par loge, densité, **état sanitaire** agrégé (couleur / badge), support futur **plan 2D** (drag-and-drop).
- **Affectation** : rattacher des **animaux** ou des **bandes** à une loge ; transfert depuis une autre loge.
- **Mouvements** : historique structuré (`PenMovement` / `BatchPenAssignment`) — individuel, groupe, bande entière ; scénarios type maternité → post-sevrage → engraissement.
- **Historique de loge** : occupants successifs, traitements collectifs, mortalité, nettoyage / désinfection, durée d’occupation.

## 7) Sorties du cheptel

Statuts / enregistrements métier (à modéliser au fil des itérations) :

- **Vente** : client, prix, poids, marge, facture (lien finance / marketplace interne).
- **Mortalité** : date, cause, symptômes, pièces jointes (`MortalityRecord`).
- **Abattage** : rendement carcasse, destination.
- **Transfert** : autre ferme, autre bâtiment, autre loge (traçabilité réglementaire).

Ces sorties s’appliquent à un **Animal** ou à une **Bande** (ou à une fraction de bande) selon le mode.

## 8) Cartographie avec l’existant (repo)

| Besoin produit              | État actuel | Cible |
|----------------------------|-------------|--------|
| Animal individuel + poids + santé | `Animal`, `AnimalWeight`, `AnimalHealthEvent` | Enrichir (identifiants RFID, coûts, reproduction) |
| Bande / lot                | **API + Prisma** `LivestockBatch`, pesees moyennes, sante collective | Sorties structurees, migration bande ↔ individu |
| Mode ferme + hybride       | **Amorcé**  | `Farm.livestockMode`, `Farm.livestockCategoryPolicies` |
| Bâtiments / loges          | **API** `Barn`, `Pen`, `PenPlacement`, `PenLog`, `pen-move` | Plan 2D, drag-and-drop, sous-zones structurees |
| Sorties structurées        | **API** `LivestockExit` (vente, mortalite, abattage, transfert) + MAJ statut animal / effectif bande | Factures liees finance, pieces jointes, rapports exports |
| UI adaptative              | Mobile MVP  | Feature flags / mode ferme côté client |

## 9) Phases d’implémentation recommandées

1. **Fondation** (fait / en cours) : mode ferme en base + doc ; API ferme ; individus stables.
2. **Bandes** : fait côté API (`LivestockBatch`, poids moyen, `LivestockBatchHealthEvent`). Reste : UI adaptative, filtres avancés.
3. **Loges** : fait côté API (batiments, loges, placements, journal, `pen-move`). Reste : UI plan, DnD, zones structurees.
4. **Mouvements & sorties** : deplacement loge + **sorties structurees** (`LivestockExit`). Reste : rapports, PJ, lien compta.
5. **Hybride avancé** : migrations bande ↔ individu, rapports mixtes, règles par catégorie fines.
6. **UI** : vues dashboard conditionnelles, loges drag-and-drop, offline ciblé.

## 10) Règles d’architecture API / données

- Le **mode ferme** guide les **defaults** (création animal vs création bande) mais ne supprime pas les autres entités : en hybride, les deux coexistent.
- Toute **conversion** (changement de mode, éclatement de bande) doit produire des **événements traçables** (audit / historique) pour ne pas casser les statistiques passées.
- Les **statistiques** doivent pouvoir s’agréger **par sujet** ou **par bande** ou **par loge** selon le contexte utilisateur.

Ce document doit être mis à jour à chaque évolution Prisma majeure (nouvelles tables `Batch`, `Pen`, etc.).
