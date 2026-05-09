# Architecture sécurité, permissions et protection des données

Document de référence pour concevoir Fermier Pro comme une plateforme SaaS **multi-fermes**, **multi-profils** et **conforme aux exigences métier** (finance, santé, commerce, collaboration). La sécurité est une **couche transverse** : elle guide l’architecture dès le départ et complète les guides `SUPABASE_AUTH.md`, `PRODUCT_BLUEPRINT.md` et le RBAC applicatif (`farm-scopes`, garde-fous services).

---

## 1. Objectifs de protection

| Domaine | Données à protéger | Exigence |
|--------|---------------------|----------|
| Fermes | Animaux, bandes, loges, tâches, effectifs | Isolation stricte inter-fermes |
| Finances | Coûts, revenus, marges | Accès par scope ; pas d’exposition aux rôles « terrain » non autorisés |
| Commerce | Annonces, offres, négociations | Traçabilité ; anti-fraude progressive ; vendeur identifié |
| Vétérinaire | Consultations, traitements, événements santé | Confidentialité renforcée ; audit des accès et modifications |
| Accès | Comptes, sessions, profils actifs | Auth forte ; changement de contexte explicite et vérifiable côté serveur |
| Collaboration | Invitations, scopes par membre | Révocation ; principe du moindre privilège |

---

## 2. Principes généraux (non négociables)

1. **Ne jamais faire confiance au frontend** pour l’autorisation : toute règle sensible est appliquée dans **NestJS** (garde JWT, vérification ferme, scopes RBAC) et, à terme, **PostgreSQL RLS** comme filet de sécurité si une requête contourne une couche applicative.
2. **Défense en profondeur** : auth + contrôle d’accès applicatif + validation des entrées + (cible) RLS + logs d’audit + limites de débit.
3. **Multi-tenant par conception** : chaque requête mutante ou liste filtrée sur des données de ferme doit résoudre `(utilisateur, ferme, permissions)` avant d’accéder aux données.
4. **Séparation des contextes** : producteur, vétérinaire, technicien, acheteur ont des **périmètres** distincts ; le **profil actif** est un signal serveur (header / convention API), pas seulement un état UI.

---

## 3. Authentification

### 3.1 État actuel (Supabase Auth)

- Vérification des **JWT access** côté API Nest (`SupabaseJwtGuard`).
- Mots de passe, hashage, refresh : **délégués à Supabase** (pas de stockage mot de passe applicatif).
- **Téléphone / OTP SMS** : supporté côté Supabase ; flux documenté dans `SUPABASE_AUTH.md`.
- **OAuth** : Google / Apple configurables dans le dashboard Supabase ; Facebook possible lorsque le fournisseur est activé côté Supabase.

### 3.2 Cible produit (alignement roadmap)

| Mécanisme | Priorité | Notes |
|-----------|----------|--------|
| Email / mot de passe | Standard | Via Supabase |
| Téléphone / mot de passe ou OTP | **Élevée** (Afrique) | OTP SMS déjà dans le périmètre ; fiabiliser fournisseurs par pays |
| WhatsApp OTP | Future | Architecture : même principe qu’OTP (code à usage unique) ; intégration fournisseur / passerelle à chiffrer |
| Google / Apple / Facebook | Standard | Prévoir **plusieurs identités liées** au même `User` applicatif si besoin (table de liaison ou `identities` Supabase) |

**Bonnes pratiques** : durées de session courtes pour actions sensibles ; refresh token géré par Supabase ; ne jamais exposer **JWT Secret** ni **service role** au mobile ou au frontend.

---

## 4. Multi-profils sécurisés

### 4.1 Modèle

- Un `User` possède plusieurs `Profile` (producteur, acheteur, etc.).
- Le **profil actif** doit être **explicite** (ex. `X-Profile-Id`) pour les routes qui en dépendent.
- Le backend vérifie : **identité JWT** + **profil autorisé pour cette route** + **ferme / scopes** lorsque la ressource est liée à une ferme.

### 4.2 Règle d’or

Les écrans et menus isolés côté client sont un **complément** ; l’**autorisation réelle** est dans les services Nest (et futures politiques RLS).

---

## 5. RBAC avancé (applicatif)

### 5.1 Implémenté aujourd’hui

- **Membres de ferme** : rôle (`owner`, `manager`, `worker`, `veterinarian`, `viewer`) + **scopes** stockés ou dérivés par défaut (`FARM_SCOPE` dans le code).
- **Wildcards** : `*` (tout), `prefix.*` (ex. `finance.*`).
- **Guards** : `FarmScopesGuard` + décorateur `RequireFarmScopes` sur les contrôleurs sensibles ; services appellent `FarmAccessService.requireFarmAccess` / `requireFarmScopes`.
- Exemples de scopes : `finance.read` / `finance.write`, `livestock.*`, `health.*`, `marketplace.read` / `marketplace.write`, `invitations.manage`, `chat`, etc.

### 5.2 Grille cible (affinage continu)

Les permissions métier listées ci-dessous doivent **toutes** mapper vers des codes de scope (ou sous-ressources) et être testées :

- Voir / modifier finances  
- Voir / modifier santé animale  
- Gérer ventes marketplace (ferme)  
- Déplacer animaux / loges (`housing`)  
- Supprimer des données (politique explicite par type de ressource)  
- Inviter / révoquer / **gérer les permissions** (scopes) des collaborateurs  

**Exemple métier** : un technicien avec alimentation + pesées mais **sans** `finance.read` ne doit pas voir revenus ni bénéfices — à garantir par **filtrage des endpoints** et des **champs** (DTO / projections), pas seulement par le menu mobile.

---

## 6. Isolation multi-fermes

### 6.1 Couche applicative (aujourd’hui)

- Toute route sous `/farms/:farmId/...` doit valider que l’utilisateur est **propriétaire ou membre** de cette ferme avant lecture/écriture.
- Les requêtes Prisma doivent **toujours** inclure le `farmId` (ou jointure contrôlée) pour éviter les fuites par ID deviné.

### 6.2 Couche base de données (cible forte)

- **Row Level Security (RLS)** sur PostgreSQL (Supabase) : politiques du type « l’utilisateur ne voit que les lignes des fermes auxquelles il appartient ».
- Le rôle utilisé par l’API pour les requêtes directes depuis le client **ne doit pas** être le `service_role` exposé ; l’API Nest utilise aujourd’hui Prisma avec un accès **privileged** : la **défense principale** est le code ; **RLS** sert de **sécurité supplémentaire** pour réduire l’impact d’un bug ou d’un second client SQL.

---

## 7. Marketplace — sécurité et confiance

### 7.1 Déjà en place (logique métier)

- Annonces liées à une ferme : scope **`marketplace.write`** pour création / publication / annulation et **acceptation / refus d’offres** côté vendeur.
- Offres acheteur : utilisateur authentifié ; pas d’exigence de membership ferme pour acheter.

### 7.2 Roadmap confiance & anti-fraude

| Élément | Description |
|---------|-------------|
| Vérification | Email / téléphone confirmés (flags Supabase + état applicatif) |
| Badge « vérifié » | Règles produit (ex. téléphone + email + ancienneté) |
| KYC | Identité renforcée (fournisseur tiers) quand les partenaires l’exigent |
| Anti-fraude | Détection comptes jetables, spam offres, anomalies de prix (règles + ML léger plus tard) |
| Preuves | Historique offres, statuts, messages ; horodatage ; export pour litiges |

Les **discussions** et **négociations** doivent rester **journalisées** (voir section Audit).

---

## 8. Données sensibles et chiffrement

| Type | Approche |
|------|----------|
| Mots de passe | Uniquement via Supabase (hash fort côté IdP) |
| JWT / refresh | Transport HTTPS ; secret serveur hors repo ; rotation des secrets |
| Données médicales / financières | Minimisation ; accès par scope ; à terme chiffrement applicatif ou colonnes sensibles si exigence réglementaire |
| Documents | Stockage objet (S3 / Supabase Storage) avec **URLs signées** et politiques d’accès ; pas de buckets publics pour documents médicaux/financiers |

**Interdit** : clés `service_role`, secrets backend, clés privées OAuth dans l’app mobile.

---

## 9. Logs et audit

### 9.1 Exigence

Journaliser les actions à **fort impact** : connexions (agrégées), suppressions, changements finance, santé, permissions, ventes marketplace, mouvements de cheptel.

Chaque entrée idéale : **qui** (user id), **quoi** (type d’événement), **ressource** (id), **ferme**, **avant/après** (ou diff), **horodatage**, **correlation id** (requête).

### 9.2 État

- **Implémenté** : modèle Prisma `AuditLog` (`actorUserId`, `farmId?`, `action`, `resourceType`, `resourceId?`, `metadata` JSON, index temps / ferme / ressource) et `AuditService.record()` (échecs d’écriture journalisés, sans faire échouer l’opération métier).
- **Événements branchés** (codes dans `apps/api/src/common/audit.constants.ts`) : création de ferme ; **transfert de propriété** ; suppression d’animal ; événements santé **animal** et **bande** ; création / mise à jour de **consultation véto** et ajout de **pièce jointe** ; création / **mise à jour / suppression** dépense et revenu ; acceptation d’offre marketplace ; création et acceptation d’invitation ferme ; **mise à jour / retrait de membre** de ferme.
- **Lecture** : `GET /api/v1/farms/:farmId/audit-logs` (scope **`audit.read`**, pagination `limit` + `cursor` = dernier `id` reçu). Propriétaire et `manager` couverts par `*` ; les autres rôles peuvent recevoir `audit.read` via invitation.
- **À étendre** : *diff* champs sensibles (ex. notes longues) hors métadonnées audit, rétention / archivage, export compliance.

---

## 10. API — durcissement

| Mesure | État / cible |
|--------|----------------|
| Validation DTO (`class-validator`) + `whitelist` | En place (`ValidationPipe` global) |
| Injection SQL | Prisma requêtes paramétrées — ne pas concaténer SQL brut |
| XSS | Principalement pertinent côté clients affichant du HTML ; sanitizer si rendu riche |
| Rate limiting | **Global** : `@nestjs/throttler` (~200 req / min / IP, fenêtre 60 s, surcharges `THROTTLE_*`). **Plusieurs instances** : définir **`REDIS_URL`** pour utiliser `@nest-lab/throttler-storage-redis` (compteur partagé) ; sans Redis, stockage mémoire (OK dev / une seule instance). **`TRUST_PROXY=true`** derrière un reverse proxy pour que l’IP client (`X-Forwarded-For`) soit utilisée. Les routes **`/api/v1/health*`** sont exclues (`@SkipThrottle`). |
| CORS / Helmet | À configurer explicitement en production |
| Idempotence | À considérer pour paiements / actions marketplace critiques |

---

## 11. Temps réel (WebSocket / chat)

- Chaque connexion : **authentifier** le socket (même JWT ou token dérivé court).
- Rejoindre une **room** : vérifier **membership** et scopes (`chat`, accès ferme si room liée).
- Ne jamais diffuser un événement à un client sans **contrôle d’accès** équivalent à une route REST.

---

## 12. Sauvegarde et résilience

- **Supabase** : sauvegardes managées selon le plan ; documenter RPO/RTO cible.
- Stratégie de **restauration** testée ; **export** des données utilisateur (conformité).

---

## 13. Conformité et confidentialité (orientation)

- Politique de confidentialité, **consentement** traitements, **droit à l’effacement** (compte + données associées), **export** des données.
- Préparer les flux même si la réglementation locale est encore légère : utile pour **investisseurs** et **partenariats**.

---

## 14. Synthèse « implémenté vs cible »

| Domaine | Implémenté (résumé) | Cible prioritaire |
|---------|---------------------|-------------------|
| Auth JWT Supabase | Oui | OTP WhatsApp ; durcissement session |
| RBAC ferme (scopes) | Oui (en extension) | Grille complète + tests + « field-level » finance |
| Isolation applicative ferme | Oui (services) | RLS PostgreSQL |
| Marketplace vendeur | Scopes + règles métier | Vérification compte, audit offres, anti-fraude |
| Audit structuré | Table + écriture sur flux clés + **lecture** `audit.read` | Couverture complète + export |
| Rate limiting | Global IP (défaut 200/min), Redis si `REDIS_URL`, health exemptée | Règles par route + quotas métier |
| Chiffrement docs | Selon déploiement storage | URLs signées, politiques bucket |

---

## 15. Documents liés

- `docs/SUPABASE_AUTH.md` — configuration Auth, profils, routes.
- `docs/PRODUCT_BLUEPRINT.md` — vision produit et stack cible.
- Code : `apps/api/src/common/farm-access.service.ts`, `farm-scopes.constants.ts`, garde-fous par module domaine.

---

*Ce document doit être mis à jour à chaque évolution majeure du modèle de menaces ou du périmètre conformité.*
