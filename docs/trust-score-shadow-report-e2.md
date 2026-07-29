# Rapport ombre Trust Score v2 — pré-bascule (E2)

**Date :** 2026-07-29  
**scoreVersion :** 3  
**TRUST_SCORE_V2_ACTIVE :** `false` (aucune bascule — en attente de validation)

## Décisions produit (tranchées)

1. Le score **informe sans contraindre** (pas de blocage crédit / achat).
2. Commentaires d’avis **privés** (seul avg + count exposé publiquement).
3. Seuil de publication des preuves : **5** (`TRUST_EVIDENCE_MIN_SAMPLE`).

## Vérifications runtime locales

| Check | Résultat |
|---|---|
| API `GET /trust-score/me?profileType=*` | OK — 5 profils, `scoreVersion=3`, `v2Active=false` |
| Piliers buyer | `ratings`, `paymentReliability`, `receiptTimeliness`, `disputeRecord`, `cancellationRate` |
| Piliers merchant | `ratings`, `orderFulfillment`, `confirmationSpeed`, `disputeRecord` |
| Piliers technician | `ratings`, `followUpActivity`, `regularity` |
| Preuves sous seuil | `evidence: null` + UI « Pas encore assez d'historique » |
| Visibilité counterpart | piliers filtrés (buyer : paiements / litiges / avis…) |
| Visibilité public | niveau + `ratingsSummary` ; preuves comportementales masquées |
| Retour arrière | `TRUST_SCORE_V2_ACTIVE=false` → chemin v1 conservé |

## Mapping preuves (donnée source → evidence)

| Profil | Pilier | Source brute | Preuve |
|---|---|---|---|
| producer | dataRegularity | jours de saisie (30 j) | `count` |
| producer | responsiveness | offres + crédit + chat | `null` (composite) |
| producer | commercialTrust | FarmMarketRating / escrow / annulations | `rating` si avis, sinon `ratio` escrow, sinon `null` |
| buyer | ratings | BuyerRating | `rating` |
| buyer | paymentReliability | txs paiement | `ratio` (ok / attempts) |
| buyer | receiptTimeliness | réception ≤ 14 j après envoi | `ratio` |
| buyer | disputeRecord | litiges perdus | `ratio` |
| buyer | cancellationRate | CANCELLED_BY_BUYER | `ratio` |
| merchant | ratings | MerchantRating | `rating` |
| merchant | orderFulfillment | commandes honorées | `ratio` |
| merchant | confirmationSpeed | confirmedAt − createdAt | `duration` (minutes) |
| merchant | disputeRecord | litiges perdus | `ratio` |
| vet | ratings | VetRating + VetAppointmentRating | `rating` |
| vet | appointmentHonor | RDV terminaux honorés | `ratio` |
| vet | requestReactivity | confirmedAt − requestedAt | `duration` |
| technician | ratings | TechnicianRating | `rating` |
| technician | followUpActivity | tasks + health records | `count` |
| technician | regularity | jours d’activité (30 j) | `count` |

## Distribution v1 vs v2 (données locales)

Base locale quasi vide au moment du run agent — `producerCountCompared ≈ 0`.  
Relancer en staging / prod via :

```http
GET /api/v1/admin/trust-score/shadow-report
```

(SuperAdmin) après le cron ombre `04:00` ou un recalcul manuel.

Le rapport JSON inclut désormais `byProfile[]` (distribution des niveaux v2 par métier).

## Bascule — NE PAS FAIRE sans validation

```bash
# Activation (réversible, sans redéploiement)
TRUST_SCORE_V2_ACTIVE=true

# Retour arrière immédiat
TRUST_SCORE_V2_ACTIVE=false
```

**Statut :** rapport livré — **bascule non effectuée**, en attente de validation humaine.
