# Audit technique — Fermier-Pro

**Date :** 7 juin 2026  
**Périmètre :** `apps/api`, `apps/mobile`, `apps/admin-platform`  
**Mode :** lecture seule — aucune correction de code appliquée  
**Branche auditée :** `main` (post-merge PR #28 + #29)

---

## Résumé exécutif — chiffres clés

| Domaine | Métrique | Valeur | Lecture |
|---------|----------|--------|---------|
| API | Controllers | 52 | — |
| API | Services | 75 | — |
| API | Routes HTTP (décorateurs) | ~381 | — |
| API | Routes en doublon exact (méthode + chemin) | **0** | Bon |
| API | `prisma.*` dans controllers | **1 fichier** (`auth.controller.ts`) | Dette isolée |
| API | Queries `prisma.animal.findMany/findFirst` hors repo | **35** | Dispersion modérée |
| API | `findMany` dans services | **244** | Pagination à auditer |
| API | `$queryRaw` / `$executeRaw` | **5** usages | Paramétrés |
| Mobile | Fichiers `.tsx` | ~374 | — |
| Mobile | Composants homonymes (4 paires) | **8 fichiers** | Risque imports |
| Mobile | `navigation.navigate` hors `DeepNavigationService` | **~170 / 171** | Très faible centralisation |
| Mobile | `Alert.alert` | **~205** occurrences | UX hétérogène |
| Mobile | `ActivityIndicator` direct | **329** | Pas de pattern loading unifié |
| Mobile | Appels API hors `lib/api` | **0** (backend) | Bon |
| Mobile | UUID hardcodés | **0** | Bon |
| Mobile | Types `any` | **3** | Faible dette |
| TS | `tsc --noEmit` mobile | **0 erreur** | ✅ |
| TS | `tsc --noEmit` api | **0 erreur** | ✅ |
| TS | `tsc --noEmit` admin-platform | **4+ erreurs** | ❌ |
| DB | Modèles Prisma | **87** | — |
| DB | Relations `onDelete` | **149** | Bonne couverture |
| DB | Index / unique | **195** | — |
| SQL orphelins (live) | — | **Non exécuté** | Pas d'accès prod en audit |

---

## 1. Routes API dupliquées

### Synthèse

Aucun conflit NestJS **exact** (même verbe HTTP + même chemin complet) détecté sur les 52 controllers. Les risques sont **sémantiques** : plusieurs surfaces API pour le même concept métier.

### Chevauchements par domaine

| Domaine | Fichiers | Problème |
|---------|----------|----------|
| Animaux / cheptel | `livestock.controller.ts`, `cheptel.controller.ts`, `farms.controller.ts` | Double surface statut animal : `PATCH …/animals/:id/status` vs `PATCH …/cheptel/animals/:id/status` |
| Loges / pens | `cheptel.controller.ts`, `housing/pens.controller.ts`, `housing/pen-detail.controller.ts` | Cheptel réparti sur 3 modules |
| Vétérinaire | `vets.controller.ts`, `vet-consultations.controller.ts`, `vet-appointment.controller.ts` | **3 flux visites** : legacy consultations/quotes, RDV escrow, schedule-visit |
| Finance / transactions | `finance.controller.ts`, `marketplace/escrow/marketplace-transaction.controller.ts` | Deux familles « transaction » (ferme vs marketplace) — namespaces distincts |
| Feed / stock | `farm-feed.controller.ts`, `dashboard.controller.ts` | Pas de controller `stock` séparé ; agrégat `dashboard/feed-stock` |
| Marketplace / market | `marketplace/*.controller.ts`, `market/pig-price-index.controller.ts` | **Triple pig-price-index** : `market/`, `marketplace/`, `admin/` |
| Rapports | `reports-root.controller.ts`, `farm-reports.controller.ts` | Deux `POST …/reports/generate` |
| CGU | `auth.controller.ts`, `cgu.controller.ts` | Acceptation CGU sur auth ET users |
| Membres / invitations | `farm-members.controller.ts`, `invitations.controller.ts` | Cycle de vie collaborateur scindé (cohérent mais couplé au scope `invitations.manage`) |

### Préfixes `@Controller` à risque (futurs conflits)

- `@Controller()` racine : `vets`, `vet-appointment`, `invitations`, `cgu`, `app`
- `farms/:farmId` : smart-alerts, reports, housing-move
- `marketplace` : offers, receipts
- `admin` : admin-platform, admin-pen-allocation

---

### Issues — Routes

#### TECH-001 — Double API statut animal
- **Catégorie :** ROUTE
- **Sévérité :** HIGH
- **Fichiers :** `apps/api/src/livestock/livestock.controller.ts`, `apps/api/src/cheptel/cheptel.controller.ts`
- **Description :** Deux endpoints modifient le statut d'un animal avec sémantiques différentes (simple vs liens vente/décès).
- **Impact :** Clients mobiles peuvent appeler le mauvais endpoint ; logique divergente.
- **Fix recommandé :** Canoniser sur `cheptel/animals/:id/status` côté mobile ; déprécier ou proxy l'ancien route livestock.

#### TECH-002 — Triple pig-price-index
- **Catégorie :** ROUTE / SERVICE
- **Sévérité :** MEDIUM
- **Fichiers :** `market/pig-price-index.controller.ts`, `marketplace/pig-price-index.controller.ts`, `admin-platform.controller.ts`
- **Description :** Trois services/contrôleurs pour l'indice porcin avec payloads potentiellement différents.
- **Impact :** Incohérence affichage marché vs marketplace vs admin.
- **Fix recommandé :** Un service source + adapters légers par contexte.

#### TECH-003 — Flux vétérinaire fragmentés
- **Catégorie :** ROUTE
- **Sévérité :** HIGH
- **Fichiers :** `vets.controller.ts` (schedule-visit, vet-visit-quotes), `vet-consultations.controller.ts`, `vet-appointment.controller.ts`
- **Description :** Legacy `VetConsultation` + quotes vs `VetAppointment` escrow coexistent.
- **Impact :** Notifications, dashboards et mobile peuvent cibler le mauvais flux.
- **Fix recommandé :** Matrice de statuts unifiée ; dépréciation progressive du legacy documentée.

#### TECH-004 — Double génération de rapports
- **Catégorie :** ROUTE
- **Sévérité :** LOW
- **Fichiers :** `reports-root.controller.ts`, `farm-reports.controller.ts`
- **Description :** `POST /reports/generate` et `POST /farms/:farmId/reports/generate` appellent le même service.
- **Impact :** Confusion documentation / clients.
- **Fix recommandé :** Garder uniquement la route scopée ferme ; alias déprécié sur la racine.

#### TECH-005 — CGU dupliquée auth / users
- **Catégorie :** ROUTE
- **Sévérité :** MEDIUM
- **Fichiers :** `auth.controller.ts`, `cgu.controller.ts`
- **Description :** Acceptation et statut CGU exposés deux fois.
- **Impact :** Risque de divergence de règles.
- **Fix recommandé :** Déléguer `auth/me/accept-cgu` vers `CguService` unique.

---

## 2. Services dupliqués

### Métriques

| Check | Résultat |
|-------|----------|
| Queries `prisma.animal.*` dispersées | 35 |
| Vérifications accès (`requireFarmAccess`, `requireFarmScopes`, etc.) | 171 occurrences |
| Envoi push (`sendToUser`, etc.) | 65 occurrences |
| Calculs métier (GMQ, PUMP, IC, etc.) | 63 occurrences |
| Méthodes `async create/list/update` homonymes multi-services | Normal (9/7/6) — pas un bug |

### Chevauchements logique

| Zone | Constat |
|------|---------|
| Feed ↔ Finance | `ReconciliationEngine` partagé entre `farm-feed.service.ts` et `finance.controller.ts` — **bon pattern** |
| Profitabilité | `margin` dans `finance.service.ts` + `margin-by-batch` controller — centralisé |
| Smart alerts | `SmartAlertsService` injecté dans health, reports, farm-settings — **bon** ; règles métier aussi dans modules (vets push health alerts) |
| Auth JWT | Un seul `jwt.verify` dans `supabase-jwt.verifier.ts` — **bon** |

### Issues — Services

#### TECH-006 — Logique métier dans `AuthController`
- **Catégorie :** SERVICE
- **Sévérité :** MEDIUM
- **Fichier :** `apps/api/src/auth/auth.controller.ts` (~l.96–248)
- **Description :** Seul controller avec accès Prisma direct ; `buildMeResponse` agrège profils, ferme active, vet/buyer/tech.
- **Impact :** Difficile à tester ; risque de régression sur `/auth/me`.
- **Fix recommandé :** Déplacer vers `AuthService.buildMeResponse()`.

#### TECH-007 — Calculs GMQ / rentabilité dispersés
- **Catégorie :** SERVICE
- **Sévérité :** MEDIUM
- **Fichiers :** multiples sous `cheptel/`, `dashboard/`, `finance/`, `reports/`
- **Description :** 63 références aux termes GMQ/PUMP/IC — logique potentiellement dupliquée.
- **Impact :** KPI dashboard vs rapports vs cheptel peuvent diverger.
- **Fix recommandé :** Extraire `ProfitabilityEngine` / `GmqCalculator` partagés (si pas déjà fait de façon opaque).

#### TECH-008 — Notifications push multi-points
- **Catégorie :** SERVICE
- **Sévérité :** LOW
- **Description :** 65 appels push dans ~20 services.
- **Impact :** Formats de payload notification incohérents pour deep link.
- **Fix recommandé :** Factory de payloads + enum `NotificationType` centralisée (partiellement fait via `DeepNavigationService` côté mobile).

---

## 3. Composants frontend dupliqués

### Composants homonymes (4 paires)

| Nom | Emplacements |
|-----|--------------|
| `SuccessModal` | `components/collaboration/`, `components/modals/` |
| `BaseModal` | `components/collaboration/`, `components/modals/` |
| `VetProfileModal` | `components/sante/`, `components/vet/` |
| `CreateGestationModal` | `components/shared/`, `components/gestation/` |

### Autres constats mobile

| Check | Résultat |
|-------|----------|
| Appels API backend hors `lib/api` | **0** |
| `DateTimePicker` hors `AppDatePicker` | **0** |
| UUID hardcodés | **0** |
| Devises hardcodées (XOF/FCFA) | **~50** refs / 22 fichiers |
| `navigation.navigate` direct | **~170** (vs 1 dans DeepNavigationService) |
| `farmId` via `useActiveProject` | **8 fichiers** ; reste via `route.params` |

### Issues — Frontend

#### TECH-009 — Modales dupliquées collaboration vs modals
- **Catégorie :** COMPONENT
- **Sévérité :** HIGH
- **Fichiers :** `SuccessModal.tsx`, `BaseModal.tsx` (×2)
- **Description :** Deux implémentations parallèles ; collaboration n'utilise pas toujours `ModalContext`.
- **Impact :** Overlays fantômes, comportements busy/fermeture incohérents (bug récent révocation).
- **Fix recommandé :** Supprimer les versions `collaboration/` ; migrer vers `components/modals/`.

#### TECH-010 — VetProfileModal dupliqué
- **Catégorie :** COMPONENT
- **Sévérité :** MEDIUM
- **Fichiers :** `components/sante/VetProfileModal.tsx`, `components/vet/VetProfileModal.tsx`
- **Impact :** Corrections appliquées à un seul écran.
- **Fix recommandé :** Fusionner ; props `variant: 'producer' | 'vet'`.

#### TECH-011 — Navigation non centralisée
- **Catégorie :** COMPONENT
- **Sévérité :** MEDIUM
- **Fichiers :** `ProducerPersistentTabBar.tsx` (22 navigates), `VetDashboardScreen.tsx` (11), etc.
- **Impact :** Deep links push incomplets ; régressions navigation.
- **Fix recommandé :** Étendre `DeepNavigationService` pour tous les flux critiques.

#### TECH-012 — Devises hardcodées XOF/FCFA
- **Catégorie :** COMPONENT
- **Sévérité :** MEDIUM
- **Fichiers :** `marketplaceListingForm.ts`, `FarmFinanceScreen.tsx`, `ProposalCardInChat.tsx`, etc.
- **Impact :** Fermes multi-devises mal supportées.
- **Fix recommandé :** Lire `farm_settings.currency` / `FarmAppSettings` partout.

#### TECH-013 — UX succès hétérogène (Alert vs SuccessModal)
- **Catégorie :** COMPONENT
- **Sévérité :** LOW
- **Description :** ~205 `Alert.alert` vs ~40 `open("success")`.
- **Fichiers notables :** `VetAppointmentDetailScreen.tsx`, `MarketplaceListingDetailScreen.tsx`, modales offline queue.
- **Fix recommandé :** Politique : `useModal("success")` pour succès métier ; `Alert` uniquement erreurs.

---

## 4. Incohérences état applicatif

### Clés React Query les plus utilisées

| Clé racine | ~Occurrences | Risque |
|------------|--------------|--------|
| `farmAnimals` | 22 | — |
| `cheptelPens` | 13 | Invalidation partielle |
| `farmMembers` | 12 | — |
| `farms` | 10 | — |
| `chatRooms` | 10 | Suffixes multiples (`vetMessages`, `producer`) |
| `vetDashboard` | 9 | — |
| `marketplaceOffersReceived` / `Counts` | nouveau | À documenter |

### Mutations sans invalidation évidente

| Fichier | Mutation | Gap |
|---------|----------|-----|
| `MarketplaceListingDetailScreen` | `contactSellerMutation` | Pas `chatRooms` |
| `DirectInviteModal` | invite | Pas `farmMembers` / invitations |
| `CheptelTab` | toggle/delete pen | `refetch` local seulement |
| `ReconciliationAlertModal` | merge/reject | Pas `farmFeed` dans modal |
| `sante/VetProfileModal` | chat | Pas `chatRooms` |

#### TECH-014 — Invalidation cache incomplète post-mutation
- **Catégorie :** STATE
- **Sévérité :** MEDIUM
- **Impact :** Listes périmées jusqu'au prochain focus/refetch.
- **Fix recommandé :** Checklist invalidation par domaine dans `lib/queryKeys.ts` (fichier central à créer).

#### TECH-015 — `farmId` non unifié via contexte
- **Catégorie :** STATE
- **Sévérité :** LOW
- **Description :** Écrans scopés utilisent `route.params.farmId` ; `ActiveProjectContext` limité au shell producteur.
- **Impact :** Désync si navigation sans paramètre.
- **Fix recommandé :** Hook `useFarmScope()` unifiant params + contexte.

---

## 5. Problèmes base de données

### Schéma Prisma

- **87 modèles**, **149** `onDelete`, **195** index/unique
- Table métier : `Farm` (pas `farm_profiles`), `FarmMembership` (pas `project_members`), `MarketplaceListing`, `FarmExpense`/`FarmRevenue` (pas `transactions` générique)

### Requêtes SQL du prompt — adaptation schéma

Les requêtes SQL fournies dans le cahier d'audit **ne correspondent pas** au schéma actuel. Équivalents Prisma/SQL adaptés :

```sql
-- Animaux sans ferme valide
SELECT COUNT(*) FROM "Animal" a
LEFT JOIN "Farm" f ON f.id = a."farmId"
WHERE f.id IS NULL;

-- Dépenses sans ferme
SELECT COUNT(*) FROM "FarmExpense" WHERE "farmId" IS NULL;

-- Loges sans bâtiment (si buildingId existe sur Pen)
SELECT COUNT(*) FROM "Pen" WHERE "barnId" IS NULL;

-- Membres sans utilisateur
SELECT COUNT(*) FROM "FarmMembership" pm
LEFT JOIN "User" u ON u.id = pm."userId"
WHERE u.id IS NULL;

-- Annonces marketplace sans ferme (farmId nullable)
SELECT COUNT(*) FROM "MarketplaceListing" l
LEFT JOIN "Farm" f ON f.id = l."farmId"
WHERE l."farmId" IS NOT NULL AND f.id IS NULL AND l.status = 'published';
```

**Statut :** non exécuté sur base live (audit hors connexion Supabase prod).

#### TECH-016 — Vérification orphelins non exécutée
- **Catégorie :** DB
- **Sévérité :** MEDIUM
- **Impact :** Données fantômes possibles après archivage ferme / suppressions partielles.
- **Fix recommandé :** Cron audit + requêtes ci-dessus en CI staging.

#### TECH-017 — `FarmMembership` vs concept `project_members` (doc)
- **Catégorie :** DB
- **Sévérité :** LOW
- **Description :** Documentation / prompts référencent `project_members` ; code utilise `FarmMembership`.
- **Fix recommandé :** Aligner documentation technique.

---

## 6. Failles sécurité

| Check | Résultat |
|-------|----------|
| Secrets hardcodés (hors env) | **Aucun critique** |
| URLs localhost dans mobile | **0** |
| `console.log` en prod (grep) | **0** (hors tests) |
| Routes admin sans guard | **Non** — `@UseGuards(SupabaseJwtGuard, SuperAdminGuard)` classe entière |
| `$queryRaw` | **5** — paramètres liés (advisory locks, health check, reports) |

#### TECH-018 — SQL raw (surveillance)
- **Catégorie :** SECURITY
- **Sévérité :** LOW
- **Fichiers :** `marketplace-transaction.service.ts`, `receipt.service.ts`, `reports.service.ts`, `app.service.ts`
- **Description :** Usage légitime (locks, `SELECT 1`) ; pas d'interpolation utilisateur non sanitisée détectée.
- **Fix recommandé :** Revue obligatoire à chaque nouveau `$queryRaw`.

#### TECH-019 — JWT vérification centralisée
- **Catégorie :** SECURITY
- **Sévérité :** INFO (positif)
- **Fichier :** `auth/supabase-jwt.verifier.ts`
- **Constat :** Pas de duplication `jwt.verify` dans les services.

---

## 7. Problèmes performance

| Check | Résultat |
|-------|----------|
| Boucles `for await` / `forEach async` dans services | **10** |
| `findMany` dans services | **244** |
| `findMany` sans `take/skip/limit` visible sur même ligne | **~244** (beaucoup sans pagination explicite) |
| `include:` imbriqués | Élevé — à profiler par endpoint |

#### TECH-020 — Pagination absente sur listes
- **Catégorie :** PERF
- **Sévérité :** MEDIUM
- **Description :** Nombreux `findMany` sans `take/skip` — risque sur fermes matures (animaux, logs, offres).
- **Fichiers exemplaires :** `listings.service.ts`, `farm-feed.service.ts`, `cheptel.service.ts`
- **Fix recommandé :** Pagination cursor-based sur endpoints list ; plafond par défaut `take: 100`.

#### TECH-021 — Risques N+1
- **Catégorie :** PERF
- **Sévérité :** MEDIUM
- **Description :** 10 patterns boucle + async détectés.
- **Fix recommandé :** Audit ciblé avec logging Prisma ; `include` batch ou `$transaction` groupée.

#### TECH-022 — Triple fetch pig-price-index côté client
- **Catégorie :** PERF
- **Sévérité :** LOW
- **Impact :** Mobile peut appeler `market/` et `marketplace/` pour le même KPI.
- **Fix recommandé :** Voir TECH-002.

---

## 8. Qualité TypeScript

| App | `tsc --noEmit` |
|-----|----------------|
| `apps/mobile` | ✅ 0 erreur |
| `apps/api` | ✅ 0 erreur |
| `apps/admin-platform` | ❌ Erreurs sur `veterinaires/rendez-vous/page.tsx` (props `options` manquantes sur composant filtre) |

| Métrique | Valeur |
|----------|--------|
| `: any` / `as any` | **3** |
| `catch (e)` sans typage | **~66** (0 avec `instanceof Error` dans le grep strict) |

#### TECH-023 — Erreurs TS admin-platform
- **Catégorie :** TS
- **Sévérité :** HIGH
- **Fichier :** `apps/admin-platform/src/app/[locale]/(dashboard)/veterinaires/rendez-vous/page.tsx`
- **Description :** Props `options` non définies sur composant filtre (l.94, l.115).
- **Fix recommandé :** Aligner interface du composant filtre ou passer les bonnes props.

#### TECH-024 — Catch non typés
- **Catégorie :** TS
- **Sévérité :** LOW
- **Impact :** Messages d'erreur génériques côté UI.
- **Fix recommandé :** `getUserFacingError()` systématique (déjà partiellement adopté mobile).

---

## 9. Priorités de correction

### Immédiat (CRITICAL / HIGH)

| ID | Titre | Effort estimé |
|----|-------|---------------|
| TECH-023 | TS admin-platform cassé | Faible |
| TECH-009 | Modales dupliquées (freeze UI) | Moyen |
| TECH-003 | Flux vétérinaire fragmentés | Élevé |
| TECH-001 | Double API statut animal | Moyen |

### Prochain sprint (HIGH / MEDIUM)

| ID | Titre |
|----|-------|
| TECH-006 | AuthController → AuthService |
| TECH-011 | Centraliser navigation |
| TECH-012 | Devises depuis farm settings |
| TECH-014 | Invalidation React Query |
| TECH-020 | Pagination API listes |
| TECH-016 | Audit orphelins DB (staging) |

### Backlog (MEDIUM / LOW)

| ID | Titre |
|----|-------|
| TECH-002 | Unifier pig-price-index |
| TECH-004 | Déprécier reports/generate racine |
| TECH-005 | Unifier CGU |
| TECH-007 | Centraliser calculs GMQ |
| TECH-010 | Fusionner VetProfileModal |
| TECH-013 | Uniformiser SuccessModal |
| TECH-015 | Hook useFarmScope |
| TECH-021 | N+1 profiling |

---

## Annexe — Commandes exécutées

Audit réalisé via `rg`, `find`, `tsc --noEmit`, exploration agents, et simulations de merge. Principales métriques :

```bash
# Controllers / services
find apps/api/src -name '*.controller.ts' | wc -l  # 52
find apps/api/src -name '*.service.ts' | wc -l      # 75

# Duplication routes exacte : 0 (analyse manuelle + agent)

# Métriques services
rg 'prisma\.animal\.(findMany|findFirst)' apps/api/src  # 35
rg 'prisma\.' apps/api/src --glob '*.controller.ts'    # auth only

# Mobile
find apps/mobile/src/components -name '*.tsx' | xargs basename | sort | uniq -d
# → BaseModal, SuccessModal, VetProfileModal, CreateGestationModal

# TypeScript
cd apps/mobile && npx tsc --noEmit   # OK
cd apps/api && npx tsc --noEmit      # OK
cd apps/admin-platform && npx tsc --noEmit  # ERREURS
```

---

## Validation audit

- [x] `TECHNICAL_AUDIT.md` généré
- [x] Aucune modification de code applicatif
- [ ] SQL orphelins sur base live — **à exécuter manuellement** (requêtes adaptées section 5)
- [ ] Corrections — **en attente validation produit**
