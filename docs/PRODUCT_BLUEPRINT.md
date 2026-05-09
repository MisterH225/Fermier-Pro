# Fermier Pro - Blueprint Produit & Architecture

## 1) Vision Produit

Fermier Pro est une plateforme mobile-first de gestion d'elevage professionnel, orientee Afrique, avec une approche ERP agricole specialisee.

Objectif:
- Digitaliser les operations quotidiennes
- Centraliser finance, sante, nutrition et performance
- Integrer un marketplace vivant de vente d'animaux
- Supporter le multi-fermes, multi-utilisateurs et multi-profils
- Evoluer facilement vers plusieurs especes (porcin d'abord)

## 2) Principes de Conception

- Mobile-first, UX simple, rapide, resilient
- Offline-first partiel (collecte terrain), sync automatique
- Architecture modulaire par domaines (Domain-Driven Modules)
- Separation stricte des permissions par profil actif
- Multi-tenant (fermes) avec isolation logique forte
- Securite de plateforme : voir `docs/SECURITY_ARCHITECTURE.md` (auth, RBAC, RLS cible, audit, API)
- Event-driven pour notifications et analytics

## 3) Profils & Mode Multi-Profil

Un compte utilisateur peut avoir plusieurs profils actifs:
- Producteur
- Technicien/Porcher
- Veterinaire
- Acheteur Marketplace

### Producteur = acheteur par defaut (marketplace)

Un **producteur** est toujours aussi **acheteur** sur le plan produit : il peut se rendre sur le **marketplace** pour acheter des animaux pour sa ferme (ex. porcs reproducteurs, porcelets, lots adaptes). Cote technique, il conserve un profil `buyer` en plus du profil `producer` :

- **Profil `producer`** : contexte ferme (tableau de bord, animaux, invitations, operations).
- **Profil `buyer`** : contexte marketplace (parcourir, negocier, acheter pour alimenter l'elevage).

A l'inscription, un profil acheteur est cree en premier ; l'ajout d'un profil producteur garantit la presence d'un profil acheteur si besoin.

Chaque profil a:
- Dashboard dedie
- Menus dedies
- Permissions dediees
- KPIs dedies

### Switching de profil

- L'utilisateur reste connecte
- Il choisit un `active_profile_context`
- Un token court (JWT access) inclut:
  - `user_id`
  - `active_profile_id`
  - `active_farm_id` (si contexte ferme)
  - `scopes`
- Le backend filtre toutes les routes selon ce contexte

## 4) Architecture Technique (Cible)

### Frontend Mobile
- React Native + Expo
- TypeScript
- State management: Zustand/Redux Toolkit
- Data fetching/cache: TanStack Query
- Navigation: React Navigation (stacks + tabs + drawer contextuel)
- Offline store: SQLite + queue de sync
- Media uploads: resumable upload vers S3/Cloudinary
- Push notifications: Firebase Cloud Messaging

### Backend
- Node.js + NestJS (modulaire)
- API REST (versionnee) + WebSocket Gateway (Socket.IO)
- Auth JWT (access + refresh), RBAC + ABAC contextuel
- PostgreSQL + Prisma ORM
- Redis (cache + pub/sub + rate limit + presence)
- Queue async: BullMQ (emails, notifications, exports, IA jobs)

### Infra
- Docker + CI/CD
- Observabilite: OpenTelemetry + Grafana
- Stockage fichiers: AWS S3 (ou Cloudinary pour media)
- Maps & geospatial: Google Maps + PostGIS

## 5) Architecture Backend par Modules

`apps/api/src/modules/`
- auth
- users
- profiles
- farms
- livestock (animaux, lots, genealogie)
- reproduction
- feeding-nutrition
- health-vet
- tasks
- finance
- marketplace
- chat-realtime
- notifications
- analytics
- files-media
- billing-saas
- integrations (mobile money, stripe, maps, firebase)

Chaque module contient:
- controller
- service
- repository
- dto
- entities
- policies/guards

## 6) Modele de Donnees (PostgreSQL)

## Entites Core
- users
- user_identities (email, phone, provider)
- organizations (optionnel futur B2B)
- farms
- farm_memberships
- profiles (producteur/technicien/veterinaire/acheteur)
- permissions
- role_templates

## Elevage
- species (porc, volaille, bovin, ovin, caprin, poisson...)
- breeds
- **modes de suivi par ferme** : individuel, bandes, **hybride** (politiques par catégorie) — voir [`LIVESTOCK_MODES_AND_HOUSING.md`](./LIVESTOCK_MODES_AND_HOUSING.md)
- animals (sujets identifies)
- **batches / bandes** (lots homogenes, sans ID individuelle obligatoire)
- **barns, pens** (batiments, zones, loges, compartiments) + affectations et mouvements
- animal_identifiers (QR, RFID)
- animal_weights
- animal_status_history
- animal_lineage
- animal_photos
- **pen_history**, **movements**, **mortality_records**, **sales / exits** (sorties structurees)

## Sante
- symptoms_reports
- diagnoses
- treatments
- prescriptions
- vaccines
- vaccination_plans
- mortality_events
- vet_consultations

## Nutrition
- ingredients
- ingredient_nutrients
- feed_recipes
- feed_recipe_items
- ration_plans
- feeding_logs

## Reproduction
- heat_events
- mating_events
- gestation_records
- farrowing_records
- weaning_records

## Operations
- tasks
- task_assignments
- daily_reports
- farm_observations (temperature, eau, comportement)

## Finance
- expenses
- revenues
- sales_orders
- purchase_orders
- cost_allocations
- financial_snapshots

## Marketplace
- listings
- listing_media
- offers
- negotiations
- reservations
- delivery_orders (v2)
- transaction_reviews
- trust_scores

## Communication
- conversations
- conversation_participants
- messages
- message_attachments
- calls (audio/video metadata)

## Plateforme
- notifications
- audit_logs
- activity_events
- sync_operations
- ai_recommendations (v2+)

## 7) RBAC + ABAC (Permissions)

RBAC:
- Roles standards par profil (owner, manager, worker, vet, buyer)
- Permissions fines par domaine (read/write/delete/approve)

ABAC:
- Contexte ferme obligatoire
- Ownership checks (ex: un vet voit uniquement fermes ou il est invite)
- Scope dynamique par profil actif

Exemples permissions:
- `finance.read`, `finance.write`
- `health.write_protocol`
- `livestock.read_sensitive`
- `marketplace.publish_listing`
- `tasks.assign`

## 8) API Structure (v1)

Base: `/api/v1`

- `/auth/*`
- `/profiles/*`
- `/farms/*`
- `/animals/*`
- `/reproduction/*`
- `/health/*`
- `/nutrition/*`
- `/tasks/*`
- `/finance/*`
- `/marketplace/*`
- `/chat/*`
- `/notifications/*`
- `/analytics/*`

Conventions:
- Pagination cursor-based
- Filtrage par `farmId`, `species`, `dateRange`
- Idempotency key pour operations sensibles
- Webhooks internes pour eventing

## 9) Real-time Chat Architecture

- Socket.IO namespace par domaine:
  - `/chat/internal`
  - `/chat/marketplace`
  - `/chat/vet`
- Rooms:
  - conversation room
  - farm room
  - presence room
- Message pipeline:
  1. Validation permission
  2. Persist DB
  3. Emit room
  4. Push fallback FCM si offline

## 10) Marketplace Architecture

- Listing engine (publish/update/archive)
- Negotiation engine (offer/counter-offer/state machine)
- Trust engine (notes + historique + badges verifies)
- Reservation engine (acompte + expiration + facture)
- Compliance layer (preuve sanitaire jointe aux annonces)

Etats principaux:
- listing: `draft -> published -> reserved -> sold/expired`
- offer: `pending -> countered -> accepted/rejected -> cancelled`

## 11) Navigation Mobile (structure)

- Auth Stack
- Profile Switcher Screen
- Root per profil:
  - Producteur Tabs: Dashboard, Animaux, Finance, Taches, Plus
  - Technicien Tabs: Journee, Reproduction, Rapports, Chat
  - Veterinaire Tabs: Cas, Consultations, Campagnes, Chat
  - Acheteur Tabs: Marketplace, Favoris, Negociations, Profil

## 12) User Flows Prioritaires

1. Onboarding producteur:
- Signup -> creer ferme -> inviter equipe -> config initiale

2. Cycle quotidien technicien:
- Ouvrir check-list -> saisir alimentation/sante -> rapport terrain -> escalation vet

3. Consultation veterinaire:
- Creer demande urgence -> chat vet + media -> protocole -> suivi traitement

4. Vente marketplace:
- Publier lot -> recevoir offres -> negocier -> reserver -> facture

## 13) Dashboard & Analytics

KPIs Producteur:
- mortalite, GMQ, FCR, cout/kg, marge brute, cashflow, ROI

KPIs Technicien:
- taches executees, incidents, conformite routines

KPIs Veterinaire:
- cas ouverts/fermes, delai de reponse, taux guerison

KPIs Marketplace:
- taux conversion annonce, delai vente, panier moyen

## 14) Notifications System

Canaux:
- push (FCM)
- in-app
- email (resumes)
- SMS (alertes critiques, v2)

Triggers:
- tache en retard
- mortalite anormale
- rappel vaccination
- nouvelle offre marketplace
- message non lu critique

## 15) SaaS Multi-Fermes

Modele:
- Tenant logique par `farm_id`
- Partitionnement progressif par ferme quand volume augmente
- Plan tarifaire par ferme + options modules

Plans suggeres:
- Starter
- Pro
- Enterprise

Add-ons:
- IA sante
- IA nutrition
- reporting avance
- support prioritaire

## 16) Monétisation

Revenus:
- Abonnement mensuel par ferme
- Commission marketplace par transaction
- Frais services premium (telemedecine prioritaire)
- Modules IA en add-on

## 17) Roadmap Produit

## MVP (0-4 mois)
- Auth + multi-profils + RBAC
- Gestion ferme de base
- Gestion animaux porcin
- Saisie quotidienne technicien
- Sante de base + consultations vet text/photo
- Finance de base (depenses/ventes)
- Marketplace annonces + offres simples
- Chat temps reel basique

### Avancement backend (ce repo)

- Fait : Supabase Auth (JWT), profils, fermes, invitations, elevage (animaux, **bandes / lots**, **batiments & loges**, **sorties cheptel**, pesees, taxonomie), **taches**, **finance depenses/revenus + resume**, **evenements sante par animal** et **par bande**, **chat temps reel (WS + REST)**, `FarmAccessService` + **garde scopes ferme** sur finance, taches, elevage, loges, sorties, vet, invitation, salon ferme chat.
- **Modes d’elevage & loges** : spec et phasage dans [`LIVESTOCK_MODES_AND_HOUSING.md`](./LIVESTOCK_MODES_AND_HOUSING.md) ; **champ ferme** `livestockMode` + `livestockCategoryPolicies` (hybride) pour onboarding reversible.
- A faire MVP : affinage RBAC (marketplace, regles metier fines). Fait en plus : **marketplace**, **consultations vet**, **bandes**, **batiments / loges**, **sorties cheptel**, **chat**, **RBAC scopes** sur routes ferme (`FarmScopesGuard`, defauts par role + `FarmMembership.scopes`).

## V2 (4-8 mois)
- Nutrition intelligente
- Reproduction avancee
- Reservation + acompte
- Dashboards analytiques evolues
- Offline sync robuste
- Score confiance marketplace

## V3 (8-14 mois)
- IA prevision croissance/sante
- Telemedecine enrichie (video native)
- Logistique transport
- Multi-especes complet
- API partenaires

## 18) Scalabilité Multi-Especes

Approche:
- Table `species` + regles par espece
- Config metadata (indicateurs, formulaires, cycles biologiques)
- Moteur de regles: nutrition, reproduction, sante par espece
- UI dynamique pilotee par schema

Resultat:
- On ajoute une espece sans refondre tout le systeme

## 19) Wireframes (niveau structure ecrans)

Ecrans MVP:
- Auth (login/signup/OTP)
- Profile switcher
- Dashboard Producteur
- Liste animaux + detail animal
- Journal technicien
- Consultation veterinaire (chat medical)
- Marketplace listing feed
- Ecran negociation
- Finance overview
- Notification center

Direction UI:
- Style premium naturel (vert/ocre/blanc), cards arrondies
- Actions primaires tres visibles
- Grands CTA pour contexte terrain
- Densite info adaptative selon role

## 20) Decisions de Demarrage Recommandees

1. Construire un monorepo:
- `apps/mobile`
- `apps/api`
- `packages/types`
- `packages/ui`

2. Implementer d'abord:
- Auth + profile switching
- Farm context
- Animal core
- Daily logs
- Permissions strictes

3. Introduire marketplace ensuite dans MVP phase 2 interne.
