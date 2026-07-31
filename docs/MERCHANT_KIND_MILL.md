# Sous-type commerçant « moulin »

## Résumé

Les moulins (fabricants d’aliment) réutilisent toute l’infra marchande (`MerchantProfile`,
boutiques, produits, commandes). Le sous-type est stocké sur `MerchantProfile.merchantKind`
(`standard` | `mill`, défaut `standard`).

## Feature flag `mills`

- Tout choix `merchantKind = mill` est **refusé** si le module plateforme `mills` n’est pas
  actif pour l’utilisateur (global ou allow-list de test).
- Si le flag est inactif : aucune question d’onboarding, `merchantKind` reste `standard`.
  Zéro impact sur les commerçants standard.

## Passage standard → mill

**Autorisé** via `PATCH /api/v1/merchant/me`, uniquement si le flag `mills` est actif.

Sur mobile : **Paramètres** (icône engrenage Accueil commerçant) → section
**Type de commerçant**, ou via la modale profil (avatar Accueil).

**Aucune donnée n’est effacée** : boutiques, produits, commandes, abonnement et
historique restent intacts. Seul le champ `merchantKind` change.

## API

| Endpoint | Comportement |
|----------|--------------|
| `GET /merchant/me` | Expose `merchantKind` |
| `PATCH /merchant/me/onboarding` | Accepte `merchantKind` (gardé par flag) |
| `PATCH /merchant/me` | Met à jour `merchantKind` (gardé par flag) |
| `GET /auth/me` | Expose `merchantProfile.merchantKind` |

Helper backend : `isMill(profile)` dans `apps/api/src/merchant-shop/merchant-kind.util.ts`.
