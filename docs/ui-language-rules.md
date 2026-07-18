# Règles de langage de l'app (mobile)

Public : éleveurs à littératie variable. Le français simple n'est pas optionnel.

1. **Un mot par concept** : suis le glossaire unique (`achat`, `récupération`, `problème`, `mon solde`, `paiement gardé`) — jamais deux mots pour la même idée entre circuits.
2. **Zéro jargon** : bannis `séquestre`, `escrow`, `transaction`, `litige`, `arbitrage`, `portefeuille`, `contre-déclaration`. La console admin garde son vocabulaire précis.
3. **Pictogramme sur chaque action principale** : réutilise la banque existante (`extendedMenuIcons`, icônes des tuiles) — pas de nouvelle icône maison.
4. **Chiffres proéminents** : poids, montants, effectifs et échéances s'affichent en style chiffre (voir `FinanceOverviewKpiGrid`), jamais noyés dans une phrase.
5. **Phrases ≤ 12 mots** sur les écrans de flux (confirmations, étapes, erreurs).
6. **L'échéance dit la conséquence réelle** : une phrase de délai décrit ce que fait le cron, pas une promesse marketing.
7. **Toute valeur affichée passe par une clé i18n** (`fr.ts` / `en.ts`), jamais de texte en dur, clés symétriques (test `i18n-keys-symmetry`).
