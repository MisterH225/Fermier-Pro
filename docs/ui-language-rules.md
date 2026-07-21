# Règles de langage de l'app (mobile)

Public : éleveurs à littératie variable. Le français (et l’anglais) simple n’est pas optionnel.

1. **Un mot par concept** : suis le glossaire unique — jamais deux mots pour la même idée entre circuits.

   | Concept | FR | EN |
   |---------|----|----|
   | Achat marketplace | `achat` | `purchase` |
   | Mouvement finance | `mouvement` / `entrée` | `movement` / `entry` |
   | Récupération | `récupération` | `pickup` / `recovery` |
   | Problème (ex-litige) | `problème` | `problem` |
   | Solde | `mon solde` | `my balance` |
   | Paiement bloqué | `paiement gardé` / `argent bloqué` | `held payment` |
   | Vérif. modération / profil | `vérification` | `review` |
   | Confirmation paiement / poids | `confirmer` | `confirm` |
   | Adjectif « valide » | `correct` | `valid` |
   | État (ex-statut) | `état` | `state` |
   | Décision (ex-arbitrage) | `décision` / `aide` | `decision` |

2. **Zéro jargon** (les deux langues) : bannis les termes de la liste noire ci-dessous. La console admin garde son vocabulaire précis.

   **FR — liste noire** : `séquestre`, `escrow`, `transaction`, `litige`, `arbitrage`, `portefeuille`, `contre-déclaration`.

   **EN — liste noire** : `escrow`, `transaction`, `dispute`, `arbitration`, `wallet`, `counter-declaration`.

   **Technique — interdit dans les libellés utilisateur** : `EXPO_PUBLIC_*`, `Supabase`, `localhost`, `webhook`, feature flags, chemins `.env` / commandes CLI.

3. **Pictogramme sur chaque action principale** : réutilise la banque existante (`extendedMenuIcons`, icônes des tuiles) — pas de nouvelle icône maison.

4. **Chiffres proéminents** : poids, montants, effectifs et échéances s’affichent en style chiffre (voir `FinanceOverviewKpiGrid`), jamais noyés dans une phrase.

5. **Phrases ≤ 12 mots** sur les écrans de flux (confirmations, étapes, erreurs). Cible souple ≈ 110 caractères ; plafond CI = 200 (`ui-language-guards`).

6. **L’échéance dit la conséquence réelle** : une phrase de délai décrit ce que fait le cron, pas une promesse marketing.

7. **Toute valeur affichée passe par une clé i18n** (`fr.ts` / `en.ts`), jamais de texte en dur, clés symétriques (test `i18n-keys-symmetry`).

8. **Voix active, verbe concret, une idée par phrase** : préfère la conséquence pour l’utilisateur à la procédure interne.
