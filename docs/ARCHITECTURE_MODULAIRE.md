# Architecture modulaire — plateforme Fermier Pro

Document de **direction technique** : modularité des domaines métier, monolithe modulaire, résilience, évolution vers une plateforme scalable sans sacrifier la vélocité early-stage. Complète `PRODUCT_BLUEPRINT.md`, `SECURITY_ARCHITECTURE.md` et `SETUP.md`.

---

## 1. Objectifs

Construire une **plateforme technologique agricole modulaire**, pas une simple application mobile :

| Objectif | Signification opérationnelle |
|----------|------------------------------|
| **Scalable** | Charge et équipes peuvent croître sans réécriture globale. |
| **Maintenable** | Frontières nettes entre domaines ; tests et ownership par module. |
| **Évolutive** | Nouveaux domaines (nutrition B2B, IoT, assurance…) sans casser l’existant. |
| **Résiliente** | Panne ou désactivation d’un module ≠ panne globale. |
| **Extensible** | APIs publiques, web admin, intégrations tierces possibles plus tard. |

**Principe directeur** : éviter les **dépendances fortes** entre modules ; préférer **contrats**, **événements** et **couches d’orchestration** minces.

---

## 2. Stratégie : monolithe modulaire d’abord

**Ne pas** démarrer en microservices complets (complexité DevOps, coûts, debugging pour une startup early-stage).

**À privilégier** :

1. **Modular Monolith** bien découpé (NestJS par domaine, front par zones fonctionnelles).
2. **Migration progressive** vers des services extraits uniquement quand un domaine justifie son autonomie opérationnelle (marketplace, chat, paiements, analytics, IA, etc.).

Le code vivant du repo suit déjà une **séparation par modules Nest** (`farms`, `livestock`, `marketplace`, `tasks`, `health-events`, `vet-consultations`, `finance`, `housing`, `chat`, …). La suite consiste à **renforcer les frontières** (imports, événements, feature flags) plus qu’à multiplier les dépôts.

---

## 3. Domaines métier (blocs indépendants cibles)

Chaque grand domaine doit pouvoir être **activé / désactivé / mis à jour / remplacé** sans paralyser les autres.

Exemples alignés produit :

| Domaine | Rôle |
|---------|------|
| Authentification & profils | Identité, sessions, contexte producteur / acheteur / … |
| Gestion des fermes | Tenants, invitations, RBAC ferme. |
| Animaux & bandes | Cheptel, pesées, mouvements. |
| Loges / parcs (`housing`) | Placement, capacités. |
| Santé & événements | Historique, interventions. |
| Tâches terrain | Journal technicien. |
| Marketplace | Annonces, offres, commerce. |
| Vétérinaire | Consultations, liaison métier. |
| Finance | Coûts, marges (scopes dédiés). |
| Nutrition | (Roadmap.) |
| Messagerie | Chat par ferme / contexte. |
| Notifications | Canaux, préférences. |
| Reporting / Analytics | Agrégations, exports. |
| Paiements | (Roadmap — forte isolation prévue.) |

**Règle** : un module ne doit pas **importer** la couche métier interne d’un autre module pour ses propres décisions. Réutiliser des **services transverses limités** (`FarmAccessService`, Prisma, auth) ou des **interfaces / événements**.

---

## 4. Isolation : ce que chaque module doit « posséder »

Pour tendre vers l’autonomie :

| Élément | Description |
|---------|-------------|
| Logique métier | Cas d’usage et règles dans `*.service.ts` du domaine. |
| API HTTP | Contrôleurs sous préfixe stable (`/farms`, `/marketplace`, …). |
| Permissions | Guards + scopes (`RequireFarmScopes`, marketplace write, etc.). |
| Données | Tables Prisma reliées au domaine ; conventions de nommage claires. |
| Événements domaine | À terme : émissions (`animal.created`, `listing.published`, …) sans référence concrète aux consumers. |

Les modules **communiquent** par :

- **Événements / domain events** (bus interne ou table `outbox` + worker ; évolution vers queue managée),
- **APIs HTTP internes** (appels synchrone réservés aux cas où l’UX impose une réponse immédiate, avec timeouts),
- **Contrats stables** (DTO versionnés, pas de fuite de modèle interne).

---

## 5. Exemples de résilience attendue

| Scénario | Comportement cible |
|----------|---------------------|
| Marketplace **désactivé** (feature flag / config) | Fermes, santé, loges, finances, tâches restent utilisables ; routes marketplace retournent **503** ou **404** contrôlé ; **pas** d’exception non gérée dans les autres modules. |
| Module **vétérinaire** indisponible (panne DB partielle, bug) | Producteurs et techniciens poursuivent l’élevage ; marketplace inchangé si isolé. |
| Erreur dans **un** handler d’événement | Retry / DLQ ; pas de rollback bloquant des autres consumers. |

Implémentation progressive : garde-fous dans `app.module` (chargement conditionnel), **try/catch** aux frontières des jobs async, **circuit breaker** sur appels optionnels (phase mature).

---

## 6. Activation dynamique des modules & feature flags

### 6.1 Besoins

- Par **admin plateforme**, **plan d’abonnement**, **région**, **type d’utilisateur** ou **ferme**.
- Déploiement progressif, bêta, premium, **rollback** rapide sans redeploy full si possible.

### 6.2 Approche recommandée (phases)

| Phase | Réalisation |
|-------|-------------|
| **MVP** | **Fait** : `FeatureFlagService` + `GET /api/v1/config/client` ; **`RequireFeature` + `FeatureEnabledGuard`** sur les routes REST **marketplace**, **chat**, **tasks**, **finance**, **housing** (barns/pens/move), **vetConsultations**. **WebSocket** namespace `/chat` : refus de connexion et handlers `joinRoom` / `sendMessage` si `FEATURE_CHAT=false`. Mobile : `ModuleFeatureGate` / alias marché + masquage **tâches terrain** (`FarmDetail`, `FarmTasks`, `CreateTask`). |
| **Croissance** | Flags **par tenant** (ferme ou org) en base ; cache Redis optionnel. |
| **Maturité** | Fournisseur type LaunchDarkly / Unleash pour ciblage fin ; même **interface** applicative (`FeatureFlagService.evaluate`). |

Le **frontend mobile** doit consommer un endpoint du type **`GET /config/client`** (ou champs dans `/auth/me`) pour **masquer menus et routes** — jamais se fier uniquement au UI sans enforcement serveur.

---

## 7. Frontend mobile modulaire

### 7.1 Direction

- **Registre de navigation** par domaine : enregistrement de routes / écrans par « package » logique (même monorepo au départ).
- **Menu dynamique** : construit à partir de **profil actif**, **scopes**, **modules activés** (liste renvoyée par l’API).
- **State** : TanStack Query par domaine avec clés préfixées ; possibilité future de **stores** par module si besoin.

### 7.2 État actuel (repo)

- Navigation **centralisée** (`MainNavigationShell`, pile d’écrans) ; les composants d’écran sont regroupés par **barrels** sous `apps/mobile/src/features/` et réexportés par `features/index.ts` pour un import unique depuis la coquille de navigation.
- **`farmDetailMenuVisibility(features)`** (liste fermes / header) et **`buildFarmDetailMenu(features, scopes)`** (`menuVisibility.ts`) : le détail ferme combine flags **`GET /config/client`** et scopes **`effectiveScopes`** renvoyés par **`GET /farms/:id`**.
- **Menus détail / liste ferme (données + ordre des CTA)** : `features/farm-detail-menu` (`buildFarmDetailMenuItems`), `features/farm-list-menu` (`buildFarmListHeaderSecondaryItems`, etc.).

**Carte `features/*` (mobile)** — chaque dossier expose un `index.ts` qui réexporte des écrans depuis `screens/` (ou des builders de menu) :

| Dossier | Contenu principal |
|---------|-------------------|
| `features/farms` | Menus `farm-detail-menu`, `farm-list-menu` ; écrans liste / détail / création ferme ; acceptation invitation ; **membres** et **création d’invitation**. |
| `features/livestock` | Cheptel, détail animal / bande. |
| `features/tasks` | Tâches terrain, création de tâche. |
| `features/vet` | Liste et dossiers consultations vétérinaires, pièces jointes. |
| `features/finance` | Synthèse finance, dépenses / revenus (création et édition). |
| `features/housing` | Bâtiments, loges, journal de loge, **PenMove** est aussi routé ici côté navigation loges. |
| `features/feed-stock` | Stock alimentaire, achat (lot). |
| `features/marketplace` | Catalogue, détail annonce, offres, annonces vendeur, création / édition d’annonce. |
| `features/chat` | Salons, fil de discussion, choix ferme / interlocuteur, recherche annuaire. |
| `features/platform` | Écrans transverses type **roadmap module** (`ModuleRoadmap`). |

**Convention** : les fichiers sources des écrans restent dans `screens/` jusqu’à une migration éventuelle ; les barrels servent de **frontière d’import** par domaine produit.

---

## 8. Backend : DDD / Clean dans un monolithe NestJS

Règles de discipline :

1. **Une entrée par domaine** via son `XxxModule` ; imports entre modules **explicites** dans `imports: [...]` — éviter les cycles (extraire `SharedKernel` / `CommonModule` minimal).
2. **Controllers fins** ; **services épais** avec transactions Prisma encapsulées dans le domaine concerné.
3. **Pas de logique métier** dans les guards ; ils vérifient identité / scopes uniquement.
4. **Domain events** : introduire une abstraction (`DomainEventPublisher`) avant de multiplier les appels croisés entre services.

Schéma **base de données** : aujourd’hui Prisma sur un seul schéma Postgres. **Évolution possible** : préfixes de tables par domaine (déjà implicitement), puis **schémas Postgres séparés** (`farm`, `marketplace`, …) pour préparer une extraction sans tout renommer immédiatement.

---

## 9. Communication inter-modules (event-driven)

### 9.1 Événements illustratifs

`animal.created`, `batch.moved`, `animal.sold`, `consultation.completed`, `feeding.recorded`, `marketplace.offer.accepted`, …

Les consumers **souscrivent** sans importer les classes internes du producteur.

### 9.2 File / bus

- Court terme : handler synchrone dans le même process avec **isolation try/catch** + log.
- Moyen terme : **outbox** Prisma + worker ou queue (BullMQ / SQS) pour fiabilité.

---

## 10. Observabilité & résilience

- **Logs structurés** par module (`context` = nom du domaine).
- **Métriques** par route ou par handler d’événements.
- **Retries** avec backoff sur jobs ; **circuit breaker** sur intégrations externes (paiement, SMS, cartes).
- Les erreurs **non capturées** dans un module ne doivent pas faire tomber le process : filtres d’exception Nest + supervision process (PM2 / orchestrateur).

---

## 11. Alignement long terme

Cette architecture doit permettre :

- Application **web admin** et **APIs publiques** documentées.
- **IoT / capteurs**, **IA agricole**, **ERP complet**, **B2B / B2G**, **banque / assurance**, sans remettre en cause le noyau identité–ferme–cheptel.

---

## 12. Feuille de route technique (synthèse)

| Priorité | Action |
|----------|--------|
| Court | Finaliser **frontières** imports API ; documenter **surface HTTP** par module ; erreurs marketplace **isolées** (déjà amorcé). |
| Moyen | **Feature flags par tenant** (table / cache) au-delà des variables `FEATURE_*` ; **flags par ferme** si besoin métier. |
| Moyen | **Publisher d’événements** + 1–2 flux critiques (ex. vente marketplace → audit / notification). |
| Moyen | **Navigation mobile par domaine** (`features/*`) et **`buildMenuItems(flags, scopes)`** (voir §7.2). |
| Long | Schémas DB / bounded contexts plus stricts ; extraction **service marketplace** ou **notifications** si charge ou équipe le justifient. |

**Déjà en place (MVP)** : `FeatureFlagService` + `GET /config/client` ; garde-fous REST + WebSocket `/chat` ; mobile **menus conditionnels** (`ModuleFeatureGate`, session `clientFeatures`) ; messagerie **REST + temps réel**, pagination historique, DM via **membres de ferme** ou **`GET /chat/directory/users`** (recherche nom / e-mail, **uniquement utilisateurs partageant au moins une ferme** avec l’acteur).

---

## 13. Références internes

- `docs/PRODUCT_BLUEPRINT.md` — vision produit et domaines.
- `docs/SECURITY_ARCHITECTURE.md` — RBAC, multi-tenant, RLS cible.
- `docs/SUPABASE_AUTH.md` — auth et profils.
- `docs/SETUP.md` — mise en route développeur.

---

*Document vivant : à mettre à jour lors des jalons majeurs (introduction du bus d’événements, premier service extrait, stratégie feature flags retenue).*
