# Audit navigation — alertes SmartAlerts, push et deep links

**Date :** 2026-05-29  
**Périmètre :** `apps/mobile`, `apps/api/src/smart-alerts`, push Expo  
**Statut :** Audit validé — **phase 1 implémentée** (2026-05-29) : `DeepNavigationService`, `HighlightWrapper`, `ruleKey` API, consommation des paramètres sur écrans existants, `AlertCard` + push unifiés.

---

## Résumé exécutif

| Constats | Détail |
|--------|--------|
| Navigation alertes in-app | `AlertCard` et `SmartAlertsSection` appellent `navigation.navigate(action.route, action.params)` **sans couche centrale**. |
| Push | `useSmartAlertPushNavigation` reprend la même logique (`route` + `params` JSON) — **uniquement alertes marché** envoyées côté API aujourd’hui. |
| `actionRoute` backend | Stocke un **nom d’écran React Navigation** (`FarmHealth`, `LogeDetail`, …), **pas** un `alert_type` stable. |
| Écrans « fantômes » au sens spec | **Aucun** `AlertPenScreen` / `AlertHealthScreen` / `AlertStockScreen`. Écrans intermédiaires **réels** mais **sous-utilisés** pour le contexte : `LogeDetail`, `PenDetail`, `ModuleRoadmap` (placeholder produit). |
| Paramètres contextuels | Partiellement prévus (`FarmHealth.initialTab`, `BuyerHistory.initialTab`) ; **non consommés** pour la plupart des cibles alertes (`FarmGestation`, `FarmFeedStock`, `FarmLivestock`, `FarmFinance`). |
| Alertes spec non implémentées | Tâches, collaboration, marketplace (propositions) — **absentes** du moteur `smart-alerts/rules/*.ts`. |

---

## Architecture navigation actuelle

### Stack principal

- **Conteneur :** `NavigationContainer` + `createNativeStackNavigator<RootStackParamList>` dans `apps/mobile/src/components/MainNavigationShell.tsx`.
- **Pas de nested navigator « MainTabs »** au sens React Navigation du prompt : les onglets producteur sont une **barre persistante custom** (`ProducerPersistentTabBar`) qui **navigue vers des écrans stack** selon la route focalisée (`producerMainTabFromRoute.ts`).
- **Onglets internes** : `TabSelector` **dans** chaque écran module (`FarmLivestock`, `FarmGestation`, `FarmFinance`, `SanteScreen`, `FarmFeedStock`).

### Profils

| Profil | Dashboard initial | Accès ferme / modules |
|--------|-------------------|------------------------|
| Producteur | `ProducerDashboard` | Stack complet + menu étendu (+ nutrition, gestation, tâches, marché, …) |
| Technicien | `TechnicianDashboard` | `TechFarm` → redirige vers `FarmBarns` / `FarmLivestock` / `FarmHealth` / `FarmGestation` selon onglet |
| Vétérinaire | `VeterinarianDashboard` | `VetFarmDetail` → `FarmHealth` avec `initialTab` |
| Acheteur | `BuyerDashboard` | `BuyerMarket`, `BuyerAlerts` (alertes **prix**, pas SmartAlerts ferme) |

### Fichiers clés

| Rôle | Fichier |
|------|---------|
| Types routes | `apps/mobile/src/types/navigation.ts` |
| Liste écrans stack | `apps/mobile/src/components/MainNavigationShell.tsx` |
| Carte onglet ↔ route | `apps/mobile/src/components/navigation/producerMainTabFromRoute.ts` |
| Carte alerte → navigate | `apps/mobile/src/components/smartAlerts/AlertCard.tsx` |
| Push → navigate | `apps/mobile/src/hooks/useSmartAlertPushNavigation.ts` |
| Insights IA → navigate | `apps/mobile/src/components/ai/InsightCard.tsx` (`action_route` format `Screen:key=val`) |
| Règles + `action.route` | `apps/api/src/smart-alerts/rules/*.ts` |
| Persistance | `SmartAlert.actionRoute` / `actionParams` (Prisma) |

---

## Section 1 — Toutes les SmartAlerts (backend) + navigation actuelle + cible attendue

Légende **ruleKey** : clé stable upsert (`farmId` + `ruleKey`).  
**Params API** : enrichis automatiquement avec `farmId`, `farmName` (+ `_i18n` si présent, retiré à la lecture).

### Module `cheptel` (`evaluateCheptelRules`)

| ruleKey (pattern) | Titre (résumé) | `action.route` actuel | `action.params` actuels | Écran réel aujourd’hui | Cible deep nav (spec) | `alert_type` proposé |
|-------------------|----------------|----------------------|-------------------------|------------------------|----------------------|---------------------|
| `cheptel-pen-full:{penId}` | Loge pleine | `FarmBarns` | `{ farmId }` | Liste bâtiments — **pas la loge** | `FarmLivestock` → onglet `cheptel` → `openPenId`, `highlightPen`, option `autoOpenTransfer` | `pen_full` |
| `cheptel-pen-requalify:{penId}` | Requalification Démarrage | `LogeDetail` | `{ penId, farmId }` | Écran dédié loge (stack) | `FarmLivestock` → onglet `cheptel` → `openPenId`, `showRequalificationBanner` | `pen_requalification` |
| `cheptel-stale-animals` | Mises à jour cheptel | `FarmLivestock` | `{ farmId }` | Cheptel (onglet défaut `overview`) | `FarmLivestock` → onglet `cheptel` ou filtre animaux inactifs | `animal_stale` (hors spec) |

**Écarts :** pas de `penId` dans l’alerte loge pleine ; requalification utilise un **écran séparé** `LogeDetail` au lieu du cheptel unifié.

### Module `health` (`evaluateHealthRules`)

| ruleKey (pattern) | Titre | `action.route` | Params | Écran réel | Cible spec | `alert_type` proposé |
|-------------------|-------|----------------|--------|------------|------------|---------------------|
| `health-vac-overdue:{vaccineName}` | Vaccin en retard | `FarmHealth` | `{ farmId }` | `SanteScreen` onglet défaut `overview` | `FarmHealth` → `initialTab: vaccination` + `openVaccineId` | `vaccine_overdue` |
| `health-vac-soon:…` | Rappel vaccin | `FarmHealth` | `{ farmId }` | idem | idem + `openVaccineId` si entité résolvable | `vaccine_upcoming` |
| `health-vet-visit:{recordId}` | Visite vétérinaire | `FarmHealth` | `{ farmId }` | idem | `initialTab: vet_visit` + `openVisitId` | `vet_visit_upcoming` |
| `health-disease-long:{recordId}` | Cas maladie prolongé | `FarmHealth` | `{ farmId }` | idem | `initialTab: disease` + `openDiseaseId` | `disease_active` |
| `health-mortality-month` | Mortalité élevée | `FarmHealth` | `{ farmId }` | idem | `initialTab: mortality` | `mortality_rate_high` |

**Écarts :** `recordId` / nom vaccin **non passés** dans `params` ; `FarmHealth` supporte déjà `initialTab` / `openFormKind` mais **pas** `openVaccineId` / `openDiseaseId` / `openVisitId`.

### Module `finance` (`evaluateFinanceRules`)

| ruleKey (pattern) | Titre | `action.route` | Params | Cible spec | `alert_type` proposé |
|-------------------|-------|----------------|--------|------------|---------------------|
| `finance-cat-up:{categoryId}:…` | Dépenses catégorie en hausse | `FarmFinance` | `{ farmId }` | Budget → `openCategoryId` | `budget_warning_80` (approx.) |
| `finance-expenses-up-month:…` | Dépenses globales | `FarmFinance` | `{ farmId }` | Vue d’ensemble | — |
| `finance-low-balance` | Solde bas | `FarmFinance` | `{ farmId }` | Vue d’ensemble | `low_balance` |
| `finance-margin-negative` | Marge négative | `FarmFinance` | `{ farmId }` | Rentabilité / marge bandes | `margin_negative` |

**Écarts :** `categoryId` dans ruleKey mais **absent** des params ; `FarmFinance` n’expose pas `initialTab` / `openCategoryId` / `openBatchId` dans `RootStackParamList`.

### Module `stock` (`evaluateStockRules`)

| ruleKey (pattern) | Titre | `action.route` | Params | Cible spec | `alert_type` proposé |
|-------------------|-------|----------------|--------|------------|---------------------|
| `stock-depletion-critical:{feedTypeId}` | Stock critique | `FarmFeedStock` | `{ farmId }` | `openFeedTypeId`, `highlight` | `stock_critical` |
| `stock-depletion-warning:{feedTypeId}` | Stock attention | `FarmFeedStock` | `{ farmId }` | `openFeedTypeId` | `stock_warning` |
| `stock-check-stale:{feedTypeId}` | Contrôle stock | `FarmFeedStock` | `{ farmId }` | `autoOpenControl: true` | `stock_no_check` |
| `stock-never-checked:{feedTypeId}` | Jamais contrôlé | `FarmFeedStock` | `{ farmId }` | idem | `stock_no_check` |
| `stock-cost-missing:{farmId}` | Entrées sans coût | `FarmFeedStock` | `{ farmId, feedTab: "movements", costFilter: "missing" }` | Filtre « Sans coût » | `stock_cost_missing` |
| `stock-consumption-spike:…` | Pic consommation | `FarmFeedStock` | `{ farmId }` | Vue stock / type concerné si ID dans ruleKey | — |

**Écarts :** API envoie `feedTab` / `costFilter` mais **`FarmFeedStockScreen` ne lit pas `route.params`** (filtre géré en state local uniquement). `feedTypeId` dans ruleKey **non propagé**.

### Module `gestation` (`evaluateGestationRules`)

| ruleKey (pattern) | Titre | `action.route` | Params | Cible spec | `alert_type` proposé |
|-------------------|-------|----------------|--------|------------|---------------------|
| `gestation-due-3d` | Mise bas < 3 j | `FarmGestation` | `{ farmId }` | Onglet actif + `openGestationId`, `autoOpenDetail` | `birth_imminent_3days` |
| `gestation-due-7d` | Mise bas semaine | `FarmGestation` | `{ farmId }` | Onglet `birth` + gestation | `birth_imminent_7days` |
| `gestation-overdue:{gestationId}` | Gestation dépassée | `FarmGestation` | `{ farmId, gestationId }` | Détail modal + urgence | `gestation_overdue` |
| `gestation-vaccine-overdue:{vaccineId}` | Vaccin gestation retard | `FarmGestation` | `{ farmId, gestationId }` | Détail + section vaccins | `vaccine_gestation_overdue` |
| `gestation-vaccine-soon:{vaccineId}` | Vaccin à planifier | `FarmGestation` | `{ farmId, gestationId }` | Détail | `vaccine_gestation_soon` |
| `gestation-sow-ready:{sowId}` | Truie disponible | `FarmGestation` | `{ farmId, tab: "planning" }` | Onglet planning + `highlightSowId` | `sow_available_for_mating` |
| `gestation-weaning-soon:{litterId}` | Sevrage proche | `FarmGestation` | `{ farmId }` | Onglet pertinent | — |

**Écarts :** `gestationId` / `tab` parfois en params mais **`FarmGestationScreen` ignore `route.params`** (state `tab` / `detailId` locaux seulement).

### Module `market` (`evaluateMarketRules` — global, toutes fermes)

| ruleKey | Titre | `action.route` | Params | Cible spec | `alert_type` proposé |
|---------|-------|----------------|--------|------------|---------------------|
| `market-price-variation:{category}:{date}` | Prix indice ±5 % | `BuyerDashboard` | `{}` (farmId marché N/A) | Acheteur : `BuyerMarket` ; Producteur : N/A ou indice | `price_index_variation` |

**Note :** alerte **plateforme**, pas liée à une entité ferme. Push **seule** alerte déclenchant `notifyMarketAlertPush`.

### Alertes listées dans la spec mais **absentes du backend**

| Domaine | Types spec | Statut codebase |
|---------|------------|-----------------|
| Cheptel | `animal_no_pen`, `gmq_below_target`, `sale_weight_reached` | Non générés |
| Finance | `budget_exceeded`, `batch_margin_negative`, `ic_above_target` | Partiellement couverts par règles différentes (`finance-cat-up`, `finance-margin-negative`) |
| Tâches | `task_due_today`, `task_overdue` | Non générés |
| Collaboration | `invitation_received`, `member_action` | Non générés (invitations : bannière `PendingInvitationsBanner`, pas SmartAlert) |
| Marketplace | `new_proposal`, `proposal_accepted`, `listing_expiring`, `price_alert_match` | Non générés (acheteur : `BuyerPriceAlert` API séparée) |

### Liste in-app (écrans / composants)

| Composant | Comportement navigation |
|-----------|-------------------------|
| `SmartAlertsSection` (dashboard) | Bouton « Voir tout » → `SmartAlertsList` ; cartes → `AlertCard` |
| `SmartAlertsListScreen` | Liste complète, même `AlertCard` |
| `AlertCard` | `navigation.navigate(a.route, a.params)` si `action.route` défini |

---

## Section 2 — Écrans « fantômes » et écrans à risque de duplication

### Recherche grep `AlertPenScreen|AlertHealthScreen|AlertStockScreen`

**Résultat : 0 occurrence** — ces écrans **n’existent pas**.

### Écrans à ne pas confondre avec des fantômes alertes

| Écran | Rôle | Verdict audit |
|-------|------|---------------|
| `SmartAlertsListScreen` | Liste des recommandations | **Légitime** (hub alertes, pas destination métier) |
| `BuyerAlertsScreen` | Alertes **prix acheteur** (`fetchBuyerPriceAlerts`) | **Légitime**, hors SmartAlerts ferme |
| `ModuleRoadmapScreen` | Placeholder fonctionnalité désactivée | **Placeholder produit**, pas alerte — à **garder** sauf si module activé partout |
| `LogeDetailScreen` | Fiche loge plein écran (depuis `CheptelTab`) | **Réel** mais **redondant** avec objectif « tout depuis `FarmLivestock` » pour alertes |
| `PenDetailScreen` | Ancienne fiche loge (depuis `BarnDetail`) | **Réel**, chemin parallèle à `LogeDetail` / modale `PenDetailModal` |
| `PenDetailModal` | Modale dans grille loges | **Réel** — pattern préférable pour deep nav sans nouvel écran |

### Recommandation suppression / dépréciation (après deep nav)

| Écran | Action proposée |
|-------|-----------------|
| `LogeDetail` comme **cible d’alerte** | Remplacer par deep nav → `FarmLivestock` ; **ne supprimer l’écran** tant que `CheptelTab` l’utilise au tap manuel, ou migrer tap → modale/scroll |
| `PenDetail` | Idem — usage manuel barn ; pas cible alerte |
| Routes stack dupliquées | Aucune route `Alert*` à retirer |

---

## Section 3 — Notifications push

### Implémentation actuelle

| Fichier | Rôle |
|---------|------|
| `apps/mobile/src/hooks/useSmartAlertPushNavigation.ts` | Écoute `expo-notifications` ; si `data.type === "smart_alert"` → `nav.navigate(data.route, JSON.parse(data.params))` |
| `apps/api/src/smart-alerts/smart-alerts.service.ts` | `notifyMarketAlertPush` uniquement (après sync alertes marché) |
| `apps/api/src/push-notifications/push-notifications.service.ts` | Envoi Expo ; `data` = `Record<string, string>` |
| Préférences | `FarmAlertSettings.push*` (stock, health, finance, gestation, cheptel, market) — **push non branché** sur recalcul ferme sauf market |

### Payload push actuel (marché)

```json
{
  "type": "smart_alert",
  "route": "BuyerDashboard",
  "farmId": "<farmId>",
  "params": "<JSON stringifié des action params>"
}
```

### Problèmes

1. **Même faille que in-app** : `route` = nom écran, pas `alert_type` + `entity_id`.
2. **Producteur** recevant une alerte marché est envoyé vers `BuyerDashboard` (incohérent profil).
3. **Champs spec manquants** : pas de `module`, `alert_type`, `entity_id` dédiés.
4. i18n note settings : envoi serveur → Expo **partiellement** implémenté (market seulement).

### Navigation corrigée (cible)

```
onNotificationPress → DeepNavigationService.navigateFromPayload(navigationRef, {
  alertType: string,      // ex. stock_critical
  module: string,         // ex. stock
  entityId?: string,      // ex. feedTypeId
  farmId: string,
  farmName?: string,
  profileType: producer | technician | veterinarian | buyer
})
```

| Type (ex.) | Push + in-app cible |
|------------|---------------------|
| `stock_cost_missing` | `FarmFeedStock` + `filterCostMissing: true` |
| `market-price-variation` | Buyer → `BuyerMarket` ; Producer → roadmap ou écran indice si ajouté |
| `gestation-overdue` | `FarmGestation` + `openGestationId` |

### Autres notifications

| Source | Navigation |
|--------|------------|
| Messages admin | `AdminMessagesModal` (modal, pas stack) |
| Chat | `ChatRoomScreen` → lien annonce → `MarketplaceListingDetail` |
| Invitations ferme | `PendingInvitationsBanner` / `AcceptFarmInvitation` (deep link `fermier-pro://invite/:token`) |

---

## Section 4 — Écrans existants : paramètres à ajouter / déjà partiels

### Matrice paramètres (spec vs `RootStackParamList`)

| Écran | Params déjà typés | Params à ajouter (spec) | Consommation actuelle |
|-------|-------------------|-------------------------|------------------------|
| `FarmLivestock` | `farmId`, `farmName` | `openPenId`, `highlightPen`, `autoOpenTransfer`, `showRequalificationBanner`, `filterNoPen`, `animalId`, `autoOpenSale`, `initialTab` | **Non** — onglets via `TabSelector` state interne |
| `FarmHealth` | `initialTab`, `openFormKind` | `openVaccineId`, `openDiseaseId`, `openVisitId` | **Partiel** (`initialTab` dans `SanteScreen`) |
| `FarmFinance` | `farmId`, `farmName` | `initialTab`, `openCategoryId`, `highlightOverrun`, `openBatchId` | **Non** |
| `FarmFeedStock` | `farmId`, `farmName` | `openFeedTypeId`, `autoOpenControl`, `filterCostMissing`, `feedTab` | **Non** (API envoie déjà `costFilter` / `feedTab` sans effet) |
| `FarmGestation` | `farmId`, `farmName` | `openGestationId`, `autoOpenDetail`, `highlightUrgent`, `openVaccineSection`, `highlightSowId`, `initialTab` | **Non** (API envoie parfois `gestationId`, `tab`) |
| `FarmTasks` | `farmId`, `farmName` | `openTaskId`, `highlightOverdue`, `initialFilter` | **Non** |
| `MarketplaceList` | `tab`, `buyerView`, … | `openListingId`, `openProposals`, `initialTab` | **Partiel** (`tab` seulement) |
| `Collaboration` | `farmId`, `farmName` | `openInvitationId`, onglet invitations | **Non** |
| `LogeDetail` | `penId`, `farmId`, `farmName` | — | Utilisé manuellement + **alerte requalification** |

### Comportement highlight (spec)

- Composant prévu : `HighlightWrapper.tsx` (pulse 2 s, scroll auto).
- **Absent** du codebase — à créer avec `DeepNavigationService`.

### Carte onglets producteur (`producerMainTabFromRoute`)

Routes **non** mappées à un onglet barre basse (restent « hors tab ») :  
`FarmGestation`, `FarmFeedStock`, `FarmTasks`, `LogeDetail`, `SmartAlertsList`, `MarketplaceList`, …

Impact : deep nav doit **naviguer vers l’écran stack** ; la barre persistante peut ne pas refléter l’onglet « Cheptel » tant que `producerMainTabFromRoute` n’inclut pas `LogeDetail` / `FarmFeedStock`.

---

## Section 5 — Autres chemins de navigation contextuelle

### Insights IA (`ModuleAIInsights` / `InsightCard`)

- `action_route` format : `ScreenName:param=value` (split `:`).
- **Différent** des SmartAlerts — à **unifier** dans `DeepNavigationService` ou adaptateur.

### Backend — évolution `SmartAlert` (spec)

| Champ actuel | Problème | Cible |
|--------------|----------|-------|
| `actionRoute` | Nom écran | Stocker **`alertType`** (ex. `pen_full`) + garder route dérivée côté mobile |
| `actionParams` | JSON libre | Structurer `entityId`, `secondaryIds`, hints onglet |
| — | — | Ajouter `entityId` colonne optionnelle (migration) si besoin index |

---

## Section 6 — Plan d’implémentation recommandé (après validation)

1. **`DeepNavigationService.ts`** — table `alertType` → `{ screen, params, profileOverrides }`.
2. **`HighlightWrapper.tsx`** — consommé par écrans module via `useRoute().params`.
3. **Brancher** `AlertCard`, `useSmartAlertPushNavigation`, (optionnel) `InsightCard`.
4. **Mettre à jour** `rules/*.ts` : `alertType` + `entityId` dans params ; routes écran dérivées côté mobile uniquement.
5. **Étendre** `RootStackParamList` + `useEffect` par écran cible (section 4).
6. **Push API** : envoyer payload unifié pour tous modules (respect `push*` settings).
7. **Tests manuels** : checklist validation du prompt.
8. **grep sécurité** : `AlertPenScreen|AlertHealthScreen|AlertStockScreen` → 0 (déjà le cas).

---

## Validation demandée

Merci de confirmer :

- [ ] La cartographie des **26+ alertes** backend ci-dessus est acceptée.
- [ ] La stratégie **pas de suppression** immédiate de `LogeDetail` / `PenDetail`, mais **fin des alertes** vers ces écrans.
- [ ] Le remplacement de `actionRoute` par **`alertType`** côté API est validé (migration / double lecture transitoire).
- [ ] Les alertes **non implémentées** (tâches, collab, marketplace) sont hors scope phase 1 ou à ajouter en règles.

**Après validation explicite uniquement** : implémentation code (`DeepNavigationService`, écrans, push, cleanup).
