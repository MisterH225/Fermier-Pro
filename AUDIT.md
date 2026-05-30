# Audit Marketplace — Fermier Pro

> Généré avant toute modification. Problèmes classés par catégorie et priorité (P0 = bloquant, P1 = important, P2 = amélioration).

---

## 1. Frontend — écrans et navigation

| Écran / composant | Fichier | Rôle |
|-------------------|---------|------|
| Hub (catalogue, mes annonces, propositions) | `apps/mobile/src/screens/MarketplaceListScreen.tsx` | Listing principal producteur |
| Détail annonce | `apps/mobile/src/screens/MarketplaceListingDetailScreen.tsx` | Offres, publication, retrait |
| Création (stack) | `apps/mobile/src/screens/CreateMarketplaceListingScreen.tsx` | Brouillon plein écran |
| Édition | `apps/mobile/src/screens/EditMarketplaceListingScreen.tsx` | PATCH titre/prix/lieu |
| Modale création | `apps/mobile/src/components/marketplace/CreateMarketplaceListingModal.tsx` | Brouillon depuis hub |
| Champs formulaire | `apps/mobile/src/components/marketplace/MarketplaceListingFormFields.tsx` | Ferme, animal, prix unitaire |
| Redirects | `MarketplaceMyListingsScreen`, `MarketplaceMyOffersScreen`, `BuyerMarketScreen` | `replace` → hub |
| Favoris / historique acheteur | `BuyerFavoritesScreen`, `BuyerHistoryScreen` | Flux parallèles |

### P0 — Frontend

1. **Cartes catalogue sans titre, ferme, note** — `renderListingCard` n’affiche pas `title`, `farm.name`, `farmRatingSummary`, ni badges Vendu/Expiré.
2. **Placeholder photo = emoji 📸** — pas d’icône porc cohérente ; bloc gris vide visuellement pauvre.
3. **Détail annonce hors design system** — couleurs hardcodées `#5d7a1f`, `#f9f8ea` ; pas de `mobileTheme` / i18n.
4. **Détail sans photos, catégorie, poids/prix/kg/total, résumé sanitaire** — champs API présents, UI absente.
5. **Modales manquantes** — `ProposalModal`, `CounterProposalModal`, `SaleConfirmModal`, `ProposalDetailModal` inexistantes ; tout inline + `Alert`.
6. **Formulaire création incomplet** — pas de `category`, `totalWeightKg`, `pricePerKg`, `totalPrice`, `photoUrls`, `animalIds`, durée, résumé sanitaire.

### P1 — Frontend

7. **Bouton filtre avancé mort** — `onPress={() => {}}` dans `MarketplaceListScreen` (l.568-574).
8. **Empty states texte brut** — pas de `EmptyStateCard` (utilisé ailleurs sur le dashboard producteur).
9. **Pas de skeleton cards** — seulement `ActivityIndicator` centré au chargement.
10. **Header détail ignore `headline`** — titre fixe « Annonce » malgré `route.params.headline`.
11. **Double flux propositions acheteur** — hub `fetchMyMarketplaceOffers` vs historique `fetchBuyerProposals`.
12. **Historique propositions non cliquable** — `BuyerHistoryScreen` sans navigation vers détail.
13. **Consultations jamais incrémentées** — `postMarketplaceListingConsult` dans `api.ts` jamais appelé.
14. **Statut `countered`** — libellé dans `marketplaceLabels.ts` sans UI contre-proposition.
15. **Redirects avec flash spinner** — écrans intermédiaires vides (`MyListings`, `MyOffers`, `BuyerMarket`).

### P2 — Frontend

16. **Catégories FR en dur** — `CATEGORY_PILLS` / `categoryLabel()` vs i18n `marketScreen`.
17. **KPI mes annonces avec compteurs vues/consultations** — affichés même si 0 (acceptable mais verbeux).
18. **Stats vues/consultations sur cartes publiques** — visibles acheteur (à valider produit).
19. **Composant `MarketplaceListingCard` non extrait** — logique dupliquée, difficile à maintenir.
20. **Boutons locaux** — pas de `PrimaryButton` / `OutlineButton` systématique sur le détail.

---

## 2. Process — flux vente (backend + mobile)

### Flux implémenté aujourd’hui

```
draft → publish → published
published + offre pending → accept → reserved (+ autres offres rejected)
reserved → patchPickup → completeHandover → sold (statut seul)
```

### P0 — Process

1. **Vente non atomique** — `completeHandover()` ne met à jour que `listing.status = sold`. Aucun Cheptel, aucune Finance (`listings.service.ts` l.487-498).
2. **Cheptel / Finance existent ailleurs** — `CheptelService.sellAnimal()` fait la transaction complète mais n’est pas branché au marketplace.
3. **Contre-proposition absente** — schéma `OfferStatus.countered` + `counterPricePerKg` sans endpoint ni service.
4. **Pas de modale / payload vente finale** — pas de poids final, prix final, date, notes côté API.
5. **Double proposition active non bloquée** — `OffersService.create()` ne vérifie pas une offre `pending`/`countered` existante pour le même acheteur.
6. **Publication sans `expiresAt`** — colonne en base, jamais renseignée à `publish()`.
7. **Aucune notification push marketplace** — `MarketplaceModule` n’importe pas `PushNotificationsModule`.

### P1 — Process

8. **`healthSummary` jamais persisté** — calcul dynamique `farmHealthSnapshot()` au GET détail uniquement ; colonne JSON jamais écrite à la publication.
9. **Statut `expired` jamais appliqué** — filtre lecture `expiresAt > now` mais aucun cron `published → expired`.
10. **Renouvellement annonce expirée** — non implémenté.
11. **Expiration propositions (7j)** — non implémenté.
12. **Acceptation offre → `reserved` pas `sold`** — commentaire mobile `acceptMarketplaceOffer` trompeur (« vendue »).
13. **Animaux « en vente »** — pas de champ `listing_id` sur `Animal` ; lien via `animalIds` JSON seulement.
14. **Offre acheteur : prix/kg** — API supporte `proposedPricePerKg` ; mobile envoie seulement `offeredPrice` total.

### P2 — Process

15. **Upload photos marketplace mobile** — `photoUrls` supporté API, aucun upload UI mobile.
16. **Chat / acompte / facture** — blueprint §9-10 non codé.
17. **Déduplication vues/consultations** — chaque ouverture incrémente (pas par utilisateur).
18. **Notification « annonce vue X fois »** — non requis (optionnel spec).

---

## 3. Notifications push — matrice

| Événement | Destinataire | Requis | État |
|-----------|--------------|--------|------|
| Nouvelle proposition | Vendeur | Oui | **Absent** |
| Proposition acceptée | Acheteur | Oui | **Absent** |
| Proposition refusée | Acheteur | Oui | **Absent** |
| Contre-proposition | Acheteur | Oui | **Absent** (flux absent) |
| Vente conclue | Vendeur + Acheteur | Oui | **Absent** |
| Annonce expirée | Vendeur | Oui | **Absent** |
| Proposition expirée (7j) | Acheteur | Oui | **Absent** |
| Annonce vue X fois | Vendeur | Non | Absent |

---

## 4. Design system — conformité boutons

| Attendu | Constat marketplace |
|---------|---------------------|
| Primary 48px, radius 12, accent | Mélange `TouchableOpacity` locaux, tailles variables |
| Outline primary | Parfois border 2px vert hardcodé |
| Destructive #E24B4A | `#b00020` sur détail |
| Footer modal sticky | `BaseModal` (modals/) supporte `footerPrimary` ; détail n’utilise pas |
| Un seul primary par vue | Détail : plusieurs boutons verts |

---

## 5. Plan de correction (ordre d’exécution)

1. **AUDIT.md** (ce fichier)
2. **Frontend** — cartes, empty/skeleton, suppression filtre mort, modales, détail aligné design system
3. **Process API** — publish (`expiresAt`, `healthSummary`), counter, complete-handover atomique, anti-doublon offre, cron expiration, push
4. **Mobile API + modales** — brancher nouveaux endpoints
5. **Validation TypeScript** — 0 erreur sur fichiers marketplace

---

## 7. Corrections appliquées (post-audit)

### Frontend
- `MarketplaceListingCard` : titre, ferme, note, badges Vendu/Expiré, icône porc
- `EmptyStateCard` + skeletons sur le listing
- Filtre avancé mort supprimé
- `ProposalModal`, `CounterProposalModal`, `SaleConfirmModal`
- Détail : galerie, prix/kg/poids/total, résumé sanitaire, design system, consultations API
- i18n FR/EN étendu

### Process API
- `publish` : `expiresAt` + `healthSummary` persistés
- `complete-handover` : transaction atomique Cheptel + Finance
- Contre-proposition + acceptation acheteur
- Anti-doublon offre active
- Cron expiration annonces + offres 7j
- Push à chaque étape clé
- `renew` annonce expirée

### Reste optionnel
- Upload photos mobile
- Formulaire création porc complet (catégorie, poids, prix/kg) — champs API prêts, UI formulaire à enrichir
- Champ `listing_id` sur Animal (non en schéma)

---

## 6. Fichiers clés

**Mobile:** `MarketplaceListScreen.tsx`, `MarketplaceListingDetailScreen.tsx`, `MarketplaceListingFormFields.tsx`, `lib/api.ts`, `lib/marketplaceLabels.ts`

**API:** `listings.service.ts`, `offers.service.ts`, `listings.controller.ts`, `offers.controller.ts`, `marketplace.module.ts`, `cheptel.service.ts` (référence transaction vente)
