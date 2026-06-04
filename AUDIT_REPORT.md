# Rapport d'audit — Fermier Pro

**Date :** 3 juin 2026  
**Périmètre :** `apps/mobile`, `apps/api` (références croisées), thèmes et design system  
**Branche analysée :** `main` (commit au moment de l’audit)  
**Mode :** lecture seule — aucune correction de code appliquée  

**Commandes de validation exécutées :**
- `npm run typecheck:mobile` — OK
- `npm run build:api` — OK

**Méthodologie :** scans `rg` sur motifs UI/processus, revue des composants de référence (`BaseModal`, `EventList`, `AppDatePicker`, etc.), échantillonnage des écrans listés dans le cahier des charges, comptages globaux.

---

## Synthèse exécutive

| Domaine | Sévérité globale | Commentaire |
|--------|------------------|-------------|
| UI / design system | **Élevée** | Fond legacy `#f9f8ea` sur ~60 fichiers ; `EmptyStateCard` quasi absent ; ~142 fichiers avec `ActivityIndicator` sans skeleton local |
| Doublons | **Moyenne–élevée** | Deux `BaseModal` ; marketplace en modal + stack ; création loge triple voie |
| Processus | **Moyenne** | 81 fichiers avec `Alert.alert` ; succès souvent hors `SuccessModal` |
| Logique métier | **Faible–moyenne** | GMQ et pricing marketplace plutôt centralisés côté API ; cache React Query dispersé |
| TypeScript | **Faible** | Builds passent ; dette `@deprecated` et API legacy dans `api.ts` |
| Code mort | **Moyenne** | Écrans/routes dépréciés conservés pour compatibilité navigation |

---

## 1. UI_INCONSISTENCIES — Écrans non alignés au design system

### 1.1 Référence thème

Fond standard documenté dans `mobileTheme.ts` :

- `mobileColors.canvas` = `#F2F2F7` (écrans)
- `mobileColors.background` = `#FFFFFF` (cartes)

`defaultStackScreenOptions` (`navigationHeaderOptions.ts`) applique `contentStyle.backgroundColor: mobileColors.canvas` et `headerBackTitle: ""` (retour sans libellé).

### 1.2 Fonds (backgrounds)

| Constat | Détail |
|--------|--------|
| Pas de `#F5F0E8` | Aucune occurrence du beige spécifié dans le cahier des charges |
| Fond legacy producteur | **`#f9f8ea`** présent dans **~60 fichiers** (écrans formulaire stack, `InactiveModuleScreen`, `FarmDetailScreen`, etc.) |
| Buyer | `buyerTheme.primaryLight` = `#F5F0FF` (violet clair, hors `mobileTheme`) |
| Écrans à palettes multiples | `FarmDetailScreen.tsx` — nombreux `backgroundColor` hex locaux (`#fdfaf3`, `#f0f5e4`, `#eef6f8`, …) |

**Écarts par zone (échantillon) :**

| Zone | Fichiers représentatifs | Problème |
|------|-------------------------|----------|
| Stack producteur (CRUD ferme/loge/finance) | `CreatePenScreen`, `CreatePenLogScreen`, `EditFarmExpenseScreen`, `EditFarmRevenueScreen`, `CreateVetConsultationScreen`, `FarmBarnsScreen` | `flex: { backgroundColor: "#f9f8ea" }` au lieu de `mobileColors.canvas` |
| Module guard | `ModuleGuard.tsx` → `InactiveModuleScreen` | Fond `#f9f8ea`, typo `#1f2910` / `#6d745b` — pas `mobileTheme` |
| Vet | `VetDashboardScreen`, `VetAgendaScreen` | Couleurs agenda / badges en dur |
| Projets | `ProjectCard`, `ProjectSwitcher` | `#fef3c7` |

### 1.3 Modaux — règle « tous étendent `BaseModal` »

**Référence canonique :** `apps/mobile/src/components/modals/BaseModal.tsx` (sheet animé, `mobileTheme`).

**~53 fichiers** importent ce `BaseModal`.

**Doublon architectural :** `apps/mobile/src/components/collaboration/BaseModal.tsx` — API différente (`title` obligatoire, `confirmLabel`, pas de sheet swipe identique). Utilisé par :

- `InviteModal`, `MemberModal`, `SearchCollaboratorModal`, `RespondScanRequestModal` (import `./BaseModal`)

**Fichiers avec `<Modal` React Native sans usage de `modals/BaseModal` dans le même fichier :**

| Fichier | Remarque |
|---------|----------|
| `collaboration/SuccessModal.tsx` | Modal + blur custom |
| `collaboration/ConfirmDeleteModal.tsx` | Modal RN brut |
| `collaboration/PendingInvitationsModal.tsx` | |
| `modals/SuccessModal.tsx` | Blur plein écran — **intentionnel** pour couche globale |
| `modals/ConfirmDeleteModal.tsx` | Idem `AppModalsLayer` |
| `PhoneOtpAuth.tsx` | Auth OTP |
| `ProfilePickerModal.tsx` | Sélection profil |
| `ProducerProfileModal.tsx`, `VetProfileModal.tsx`, `TechProfileModal.tsx`, `BuyerProfileModal.tsx` | Profils plein écran |
| `FarmMapPickerModal.tsx` | Carte |
| `ExtendedMenuGrid.tsx` | Menu étendu |
| `AdminMessagesModal.tsx` | Admin |
| `ActiveProfileSwitcherModal.tsx`, `ProfileLanguagePill.tsx` | Compte |
| `MarketplaceListingFormFields.tsx` | Sous-modales inline dans formulaire |
| `EditMarketplaceListingScreen.tsx` | Modal locale écran |

**Modaux conformes (échantillon) :** `CreateAnimalModal`, `TransactionModal`, `BudgetSetupModal`, `StockModal`, `DiseaseModal`, `BulkVaccineModal`, `ProposalModal`, `MiseBasModal`, `CreateGestationModal` (shared), `AppDatePicker` (wrappe `BaseModal`).

### 1.4 SuccessModal / confirmations

| Mécanisme | Usage |
|-----------|--------|
| `useModal` + `AppModalsLayer` + `modals/SuccessModal` | Flux finance, cheptel (partiel), pattern recommandé |
| `collaboration/SuccessModal` | Collaboration uniquement — **deuxième implémentation** |
| `Alert.alert` pour succès | Ex. `FarmGestationScreen` (`createSuccessTitle`), `MarketplaceListingDetailScreen` (« Enregistré »), `ProducerProfileModal` (GPS), `SanteScreen` (`linkOk`) |

**81 fichiers** contiennent `Alert.alert` (erreurs, confirmations, permissions).

### 1.5 Date pickers

| Constat |
|--------|
| `AppDatePicker.tsx` est le seul composant métier ; il encapsule le picker natif dans `BaseModal` |
| Aucun import direct de `@react-native-community/datetimepicker` hors `AppDatePicker` sur `main` |
| Écrans stack legacy utilisent parfois des champs texte + validation manuelle plutôt que `AppDatePicker` |

### 1.6 EmptyStateCard

**Définition :** `components/common/EmptyStateCard.tsx`

**Usages réels (2 écrans seulement) :**
- `ProducerDashboardScreen.tsx`
- `MarketplaceListScreen.tsx`

**Pattern dominant ailleurs :** `Text` centré, couleur `#6d745b` ou `mobileColors.textSecondary`, parfois icône ad hoc — ex. onglets santé, listes chat, finance, cheptel.

### 1.7 EventList / listes

| Métrique | Valeur |
|----------|--------|
| Fichiers avec `EventList` | ~30 |
| Fichiers avec `FlatList` | ~30 |

Beaucoup d’historiques restent en `FlatList` + rendu custom (messages, marketplace offres, vet agenda, collaboration membres).

### 1.8 TabSelector / SmartChart

| Composant | Fichiers (~) |
|-----------|----------------|
| `TabSelector` | 13 |
| `SmartChart` | 13 |

Couverture partielle : certains sous-onglets utilisent encore des `Pressable` + styles locaux.

### 1.9 InactiveModuleScreen

- Exporté depuis `ModuleGuard.tsx`
- **Non réutilisé** comme composant standalone ailleurs ; seul `ModuleGuard` l’affiche
- Style legacy (`#f9f8ea`) incohérent avec le reste de l’app moderne

### 1.10 Headers / navigation retour

| Règle | État |
|-------|------|
| `headerBackTitle: ""` | Appliqué globalement via `defaultStackScreenOptions` |
| Retour avec texte | `PenMoveScreen.tsx` : `← Autre bâtiment` ; `VetConsultationDetailScreen` : bouton alerte « Retour » |
| Titres | `useScreenTitle` + headers natifs sur la majorité des écrans stack ; `PageHeader` marqué `@deprecated` pour le titre principal |

### 1.11 Loading states (skeleton vs spinner)

| Métrique | Valeur |
|----------|--------|
| Fichiers avec `ActivityIndicator` | ~142+ |
| Fichiers avec `ActivityIndicator` **sans** mot « Skeleton » dans le même fichier | **~142** |
| Fichiers avec composants Skeleton | **3** (`EventList`, cartes marketplace, etc.) |

**Écrans critiques (spinner seul) :** `ProducerDashboardScreen`, `FarmFinanceScreen`, `SanteScreen` (+ tabs), onboarding steps, vet/tech dashboards, `ChatRoomScreen`, `SettingsScreen`.

### 1.12 Messages techniques visibles

**29+ fichiers** affichent `error.message` (souvent message HTTP/API brut) :

- `ProducerDashboardScreen` (finance, gestation, santé, alimentation)
- `MarketplaceListScreen`, `MarketplaceListingDetailScreen`
- `FarmFinanceScreen`, `PenDetailScreen`, `LogeDetailScreen`
- Messagerie : `ChatRoomScreen`, `ProducerMessagesScreen`, `BuyerMessagesScreen`, `VetMessagesScreen`
- `HealthOverviewTab.tsx` : `<Text>{error.message}</Text>`

**Dev / env :**
- `LoginGateScreen.tsx` — références localhost / mode exp (acceptable en dev si non visible prod)
- `env.ts` — configuration API

**Alert.alert avec `e.message` :** nombreux écrans CRUD (`CreateFarmExpenseScreen`, `EditFarmRevenueScreen`, `BatchDetailScreen`, `SettingsScreen`, etc.)

### 1.13 Audit par écran (cahier des charges)

Légende : ✅ aligné | ⚠️ partiel | ❌ écart notable

| Écran / module | Modaux | Empty | Loading | Fond | Notes |
|----------------|--------|-------|---------|------|-------|
| Onboarding (steps 1–4 + completion) | ⚠️ | ❌ | ❌ spinner | ❌ `#f9f8ea` sur steps stack | Pas `EmptyStateCard` |
| CGU / Privacy | ⚠️ | — | — | ⚠️ | `CGUScreen` dans onboarding |
| Login / `LoginGateScreen` | ⚠️ `PhoneOtpAuth` | — | ⚠️ | ✅ canvas sur stack moderne | Texte technique dev |
| `ProducerDashboardScreen` | ✅ partiel | ✅ `EmptyStateCard` | ❌ | ⚠️ | `error.message` sur cartes |
| Cheptel tabs | ✅ modaux animaux/loge | ❌ | ❌ | ⚠️ | `CreatePenModal` + `CreateLogeModal` |
| `LogeDetailScreen` / `PenDetailScreen` | ✅ | ❌ | ❌ | ⚠️ | Erreurs brutes |
| `CreateAnimalModal` | ✅ `BaseModal` | — | — | ✅ | Conforme |
| `BulkAddAnimalsModal` | — | — | — | — | **Absent sur `main`** (PR #16 uniquement) |
| Finance (`FarmFinanceScreen`, budget) | ✅ `TransactionModal`, `BudgetSetupModal` | ❌ | ❌ | ❌ écrans edit/create `#f9f8ea` | Très gros écran, erreurs API visibles |
| Santé (`SanteScreen` + tabs) | ✅ `DiseaseModal` | ❌ | ❌ | ⚠️ | `Alert` succès liaison |
| `BulkVaccineModal` | ✅ | — | — | ✅ | |
| Stock aliment (`FarmFeedStockScreen`) | ✅ `StockModal` | ❌ | ❌ | ⚠️ | |
| Gestation (`FarmGestationScreen`) | ✅ | ❌ | ❌ | ⚠️ | Succès via `Alert.alert` |
| Market (`MarketplaceListScreen` + détail) | ✅ `CreateMarketplaceListingModal`, `ProposalModal` | ✅ liste publique | ⚠️ skeleton cartes | ⚠️ buyer theme | **Pas de `ListingModal`** — nom spec obsolète |
| `ChatScreen` / rooms | ❌ liste custom | ❌ | ❌ | ✅ | FlatList messages |
| Collaboration | ❌ **2e BaseModal** | ❌ | ❌ | ⚠️ | Success/Delete collaboration séparés |
| Tâches (`TasksScreen` / `FarmTasksScreen`) | ✅ | ❌ | ❌ | ⚠️ | `FarmTasksScreen` @deprecated |
| Rapports | ⚠️ | ❌ | ❌ | ⚠️ | |
| Paramètres (`SettingsScreen`) | ⚠️ | — | ❌ | ✅ | `Alert` + `e.message` |
| Profil / modales profil | ❌ Modal RN | — | — | ⚠️ | Hors `BaseModal` |
| Vet dashboard + écrans | ⚠️ | ❌ | ❌ | ⚠️ `#FEF3C7` | `VeterinarianDashboardScreen` deprecated |
| Tech dashboard + écrans | ⚠️ | ❌ | ❌ | ⚠️ | `TechnicianDashboardScreen` vs `TechDashboardScreen` |
| Buyer dashboard + écrans | ⚠️ | ❌ | ❌ | ❌ `#F5F0FF` theme | Shell buyer séparé |

---

## 2. CODE_DUPLICATES — Composants, logiques, endpoints

### 2.1 Modaux de création (même entité, plusieurs entrées)

| Entité | Doublons identifiés |
|--------|---------------------|
| **Loge / pen** | `CreatePenModal` (grille), `CreateLogeModal` (cheptel tab), **`CreatePenScreen`** + `CreatePenLogScreen` (stack plein écran) |
| **Marketplace listing** | `CreateMarketplaceListingModal` **et** `CreateMarketplaceListingScreen` / `EditMarketplaceListingScreen` — formulaire partagé `MarketplaceListingFormFields` mais **deux UX** |
| **Gestation** | `components/shared/CreateGestationModal` + re-export deprecated `components/gestation/CreateGestationModal` |
| **Transaction** | `TransactionModal` + `EditTransactionModal` (légitime) ; écrans `CreateFarmExpenseScreen` / `EditFarmExpenseScreen` **parallèles** au modal finance |

### 2.2 Listes / EventList

- **~30** `FlatList` vs **~30** `EventList` — ratio 50/50, pas de règle stricte appliquée
- Messagerie, marketplace, vet agenda : implémentations custom répétées (avatar, date, badge)

### 2.3 Cards données

- Cartes dashboard producteur vs cartes vet/tech/buyer : styles différents
- `MarketplaceListingCard` vs cartes cheptel : structures similaires (titre, meta, CTA) sans composant `DataCard` générique

### 2.4 Navigation

| Élément | Constat |
|---------|--------|
| `DeepNavigationService` | Utilisé dans **2 fichiers** (`useSmartAlertPushNavigation`, `AlertCard`) — quasi inexploité ailleurs |
| `navigation.navigate` direct | Omniprésent ; risque d’écrans « fantômes » si routes non maintenues dans `types/navigation.ts` |

### 2.5 Formulaires dupliqués

- Champs montant / catégorie / date recopiés sur écrans stack `#f9f8ea` au lieu de composants partagés (`AppDatePicker`, champs finance unifiés)
- `MarketplaceListingFormFields` centralise bien le marché ; pas d’équivalent générique « Montant + devise »

### 2.6 Logiques métier dupliquées

| Catégorie | État sur `main` |
|-----------|-----------------|
| **Calculs financiers marketplace** | Centralisés : `lib/marketplaceListingForm.ts`, `listingPricing` côté mobile ; DTO + services côté API |
| **GMQ** | API : `cheptel-gmq.util.ts`, `age-calculation.service.ts` ; mobile : `GMQCard` consomme l’API — **pas de recalcul GMQ massif côté mobile** |
| **Permissions** | API : guards Nest dispersés (`JwtAuthGuard`, décorateurs ferme) — **~34 fichiers** avec patterns `can` / membership ; pas un seul middleware documenté |
| **Push** | **Centralisé** : `PushNotificationsService` (API) ; appelé depuis marketplace, invitations, modération, etc. |
| **Cache React Query** | **65 fichiers** avec `invalidateQueries` ; seul helper dédié identifié : `invalidateFarmFinanceQueries.ts` — pas de registre de clés global |
| **Auth guards mobile** | Session Supabase + token dans `api.ts` ; pas de duplication majeure hors écrans qui re-vérifient la ferme active |

### 2.7 BaseModal en double (résumé)

```
components/modals/BaseModal.tsx      ← référence design system
components/collaboration/BaseModal.tsx ← duplicate API/UX
```

---

## 3. PROCESS_DEVIATIONS — Flux hors standards

| Écart | Exemples | Impact |
|-------|----------|--------|
| Succès via `Alert.alert` | Gestation, marketplace RDV, profil GPS | UX incohérente vs `SuccessModal` |
| Erreurs via `Alert.alert(e.message)` | Tous écrans CRUD stack legacy | Fuite messages techniques |
| Suppression via `collaboration/ConfirmDeleteModal` | Collaboration | Différent de `modals/ConfirmDeleteModal` + `useModal` |
| Création entités en **écran stack** au lieu de modal | Pen, dépenses, revenus, consultations vet | Contourne le pattern sheet modal |
| Finance : modal **et** stack screens | `TransactionModal` vs `CreateFarmExpenseScreen` | Double maintenance |
| Marketplace : FAB/modal **et** navigation stack | Producteur crée annonce par deux chemins | Risque divergence validation |
| `FarmHealthScreen` / `FarmTasksScreen` routes | Toujours enregistrées, écrans @deprecated | Navigation vers code legacy |
| Feature flags | `ModuleGuard` OK ; pas toujours wrapping sur anciennes routes | Module désactivé mais route accessible |

---

## 4. LOGIC_INCONSISTENCIES — Logiques métier

| Sujet | Incohérence |
|-------|-------------|
| **Statuts marketplace** | Specs externes parfois disent `active` ; code utilise `published`, `paused`, `sold`, etc. (cohérent en interne, doc à aligner) |
| **GMQ affiché** | Source API unique ; libellés/i18n parfois mélangés FR/EN sur erreurs |
| **Ferme active** | `api.ts` expose encore `firstOwnedFarm` @deprecated vs `activeFarm` |
| **Santé** | `health-events` API @deprecated au profit de `FarmHealthRecord` ; endpoints legacy conservés |
| **Compteurs tags animaux** | Sur modèle `Farm` (`lastTruiTagNumber`, etc.) — à documenter vs `farm_settings` si spec disait autre chose |
| **Inactive module** | Message plateforme vs écran beige legacy |
| **PigPrice / listings** | Sur branche marketplace-sync (PR #17) : pause à l’archivage — sur `main` audité, archivage ferme ne synchronisait pas les annonces (écart métier connu, corrigé hors `main`) |

---

## 5. TYPESCRIPT_ISSUES — Erreurs et types

| Vérification | Résultat |
|--------------|----------|
| `tsc --noEmit` mobile | **0 erreur** |
| `nest build` API | **OK** |

### 5.1 Dette typée / API client

- `apps/mobile/src/lib/api.ts` : **très volumineux** ; plusieurs membres `@deprecated` (formats anciens, `months6`, `healthData`, `firstOwnedFarm`)
- Types navigation : `types/navigation.ts` — risque de routes optionnelles non synchronisées avec écrans deprecated

### 5.2 `@deprecated` inventaire (principal)

**Mobile :**
- `FarmHealthScreen`, `FarmTasksScreen`, `ProducerFarmSettingsScreen`, `VeterinarianDashboardScreen`
- `components/gestation/CreateGestationModal` (re-export)
- `PageHeader.title`, `producerNavMetrics`, `ExtendedMenuItem`

**API :**
- `health-events.service` (compat disease)
- `cheptel.service` (`listPenContents` vs ancienne méthode vaccins)
- `finance.service` (fenêtre 3 mois)

### 5.3 Améliorations recommandées (sans erreur compile)

- Scinder `api.ts` par domaine (livestock, marketplace, auth)
- Remplacer `any` résiduels dans mutations React Query (audit ciblé non exhaustif)
- Aligner types `ListingStatus` mobile avec Prisma après migrations

---

## 6. DEAD_CODE — Code mort identifié

| Élément | Type | Action suggérée |
|---------|------|-----------------|
| `FarmHealthScreen` | Écran + route | Rediriger vers `SanteScreen`, supprimer route |
| `FarmTasksScreen` | Écran + route | Idem → `TasksScreen` |
| `VeterinarianDashboardScreen` | Écran | Route alias vers `VetDashboardScreen` |
| `ProducerFarmSettingsScreen` | Écran | Fusion settings |
| `gestation/CreateGestationModal` | Re-export | Supprimer, imports directs shared |
| Endpoints `health-events` deprecated | API | Plan de retrait versionné |
| `DeepNavigationService` | Service sous-utilisé | Generaliser ou supprimer |
| `EmptyStateCard` | Composant **sous-utilisé** (pas mort, mais quasi) | — |
| PR #16 `BulkAddAnimalsModal` | Non sur `main` | Intégration pending |

**Faux positifs (à garder) :** `modals/SuccessModal` et `ConfirmDeleteModal` utilisent `Modal` RN mais sont la couche standard globale.

---

## 7. PRIORITY_FIXES — Liste priorisée des corrections

### P0 — UX / confiance utilisateur

1. **Ne plus afficher `error.message` / `e.message` brut** — mapper vers `t('common.errors.*')` + logging Sentry (35+ écrans).
2. **Remplacer `Alert.alert` succès** par `useModal({ type: 'success' })` (gestation, marketplace, profil).
3. **Uniformiser fond d’écran** : migration `#f9f8ea` → `mobileColors.canvas` (60 fichiers) + `InactiveModuleScreen`.

### P1 — Design system structurel

4. **Fusionner les deux `BaseModal`** — collaboration importe `modals/BaseModal`.
5. **Unifier `SuccessModal` / `ConfirmDeleteModal`** — supprimer versions `collaboration/*`.
6. **Généraliser `EmptyStateCard`** — cheptel, finance, santé, chat, rapports (checklist ~40 listes vides).
7. **Skeleton loading** — dashboard producteur, finance, santé en priorité ; pattern `EventList` existant.

### P2 — Doublons et maintenance

8. **Une seule entrée création loge** — modal OU stack, pas les trois.
9. **Marketplace** — modal OU `CreateMarketplaceListingScreen` ; documenter `ListingModal` → `CreateMarketplaceListingModal`.
10. **Registre React Query** — clés + helpers `invalidate*` par domaine (comme finance).
11. **Supprimer routes @deprecated** après redirection navigation.

### P3 — Qualité long terme

12. Découper `api.ts` mobile.
13. Étendre `DeepNavigationService` ou le retirer.
14. Audit `TextInput` styles (83 fichiers) — composant `AppTextField` partagé.
15. Aligner documentation statuts marketplace / cycle de vie ferme (PR #17).

---

## Annexes

### A. Métriques clés

| Métrique | Valeur |
|----------|--------|
| Fichiers `Alert.alert` | 81 |
| Fichiers `error.message` affiché | 29+ |
| Imports `modals/BaseModal` | ~53 |
| `<Modal` sans BaseModal dans fichier | 20 |
| `useModal(` | ~25 |
| `EmptyStateCard` | 2 usages |
| `AppDatePicker` | ~21 fichiers |
| `invalidateQueries` | 65 fichiers |
| Fond `#f9f8ea` | ~60 fichiers |

### B. Composants design system — fichier de référence

| Composant | Chemin |
|-----------|--------|
| BaseModal | `apps/mobile/src/components/modals/BaseModal.tsx` |
| SuccessModal (global) | `apps/mobile/src/components/modals/SuccessModal.tsx` |
| ConfirmDeleteModal (global) | `apps/mobile/src/components/modals/ConfirmDeleteModal.tsx` |
| EventList | `apps/mobile/src/components/lists/EventList.tsx` |
| TabSelector | `apps/mobile/src/components/navigation/TabSelector.tsx` |
| SmartChart | `apps/mobile/src/components/charts/SmartChart.tsx` |
| AppDatePicker | `apps/mobile/src/components/common/AppDatePicker.tsx` |
| EmptyStateCard | `apps/mobile/src/components/common/EmptyStateCard.tsx` |
| InactiveModuleScreen | `apps/mobile/src/components/ModuleGuard.tsx` |

### C. Prochaines étapes recommandées

1. Valider ce rapport (product / design).
2. Traiter **P0** par lot (messages erreur → thème fond).
3. Ouvrir issues GitHub par lot P1/P2.
4. Ne pas mélanger avec PR fonctionnelles (#16 bulk animals, #17 marketplace sync) sans rebase explicite.

---

*Rapport généré en mode audit lecture seule. Aucun fichier applicatif modifié.*
