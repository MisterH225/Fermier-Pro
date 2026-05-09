# Authentification Supabase (Google, Apple, telephone)

Pour la **vision sécurité globale** (multi-tenant, RBAC, audit, marketplace, conformité), voir **`docs/SECURITY_ARCHITECTURE.md`**.

L'API Nest verifie le **JWT access** emis par Supabase (`HS256` avec le **JWT Secret** du projet). Le mobile (Expo) utilise `@supabase/supabase-js` pour les flux OAuth / OTP ; le backend ne gere pas les ecrans de login, seulement `GET /api/v1/auth/me` avec `Authorization: Bearer <access_token>`.

## Variables d'environnement (racine `.env`)

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_JWT_SECRET=<JWT Secret du projet>
```

- `SUPABASE_JWT_SECRET` : **Settings -> API -> JWT Secret** (ne jamais exposer au client).
- `SUPABASE_URL` : utile pour la doc et le client mobile ; l'API Nest ne l'utilise pas encore pour verifier les jetons.

## Configuration dashboard Supabase

1. **Authentication -> Providers**
   - **Google** : activer, renseigner Client ID / Secret (console Google Cloud OAuth).
   - **Apple** : activer pour *Sign in with Apple* (compte developpeur Apple, Service ID, cle privee).
   - **Phone** : activer ; configurer un fournisseur SMS (selon region).

2. **Authentication -> URL configuration**
   - Ajouter les URL de redirection pour Expo / web (scheme `exp://` ou domaine de production).

3. **Ne pas** s'appuyer sur `user_metadata` pour des decisions d'autorisation sensibles cote RLS : preferer `app_metadata` pour les roles serveur. Ici Nest synchronise seulement profil basique (email, telephone, nom) dans la table `User` Prisma.

## Mobile (Expo) — flux recommandes

- **Config** : dans `apps/mobile/`, fichier `.env` (voir `.env.example`) avec `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`. Client partagé : `apps/mobile/src/lib/supabase.ts` (`@supabase/supabase-js` + `AsyncStorage`) ; appel API typé : `src/lib/api.ts` (`fetchAuthMe`).
- **OTP SMS dans l app** : ecran `PhoneOtpAuth` (`signInWithOtp` + `verifyOtp`, format E.164 obligatoire).
- **Google** : `signInWithOAuth({ provider: 'google', options: { redirectTo } })` ou flux natif avec `expo-auth-session` selon ta stack.
- **Apple** : `signInWithOAuth({ provider: 'apple', ... })` sur iOS.
- **Telephone** : `signInWithOtp({ phone, options: { channel: 'sms' } })` puis verification du code.

Apres `session.access_token`, appeler :

```http
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

La premiere requete cree ou met a jour l'utilisateur Prisma (`supabaseUserId` = `sub` du JWT) et assure un **profil acheteur** (`buyer`) : cree si absent (voir `AuthService.ensureDefaultBuyerProfile`).

## Producteur et marketplace

**Un producteur est aussi un acheteur** : il peut utiliser le marketplace pour acheter des porcs reproducteurs, des porcelets ou d'autres lots pour sa ferme. En pratique :

- Au premier sync, un profil **`buyer`** est cree (acces marketplace).
- Quand l'utilisateur ajoute un profil **`producer`**, le backend s'assure qu'un profil **`buyer`** existe toujours (creation si absent).
- **Ferme** : appels avec `X-Profile-Id` = profil **producer**.
- **Marketplace** : meme compte peut vendre (annonces liees a ses fermes / animaux) et acheter (offres) ; le profil actif `X-Profile-Id` n'est pas impose sur ces routes (identite = `User` via JWT).

## En-tete profil actif (optionnel ou obligatoire)

- **`X-Profile-Id`**: identifiant d'un de tes profils (`Profile.id`).
- **`GET /api/v1/auth/me`**: si tu envoies `X-Profile-Id`, la reponse inclut **`activeProfile`** valide pour cet ID.
- **`POST /api/v1/farms`**: **`X-Profile-Id` obligatoire** et doit etre un profil de type **`producer`**.

## RBAC — scopes par ferme (`FarmMembership.scopes`)

Sur les routes sous **`/api/v1/farms/:farmId/...`** sensibles, l’API exige des **scopes** metier en plus de l’appartenance a la ferme. Le **proprietaire** dispose de tout (`*`). Sinon, les scopes effectifs = **union** des `scopes` en base pour chaque ligne `FarmMembership` du couple `(user, ferme)` ; si une ligne a `scopes: []`, des **valeurs par defaut** selon le `role` s’appliquent (`manager` → `*`, `worker`, `veterinarian`, `viewer` — voir `farm-access.service.ts`).

Exemples de codes : `finance.read`, `finance.write`, `tasks.read`, `tasks.write`, `livestock.read`, `livestock.write`, `health.read`, `health.write`, `housing.read`, `housing.write`, `exits.read`, `exits.write`, `vet.read`, `vet.write`, `invitations.manage`, `chat`, `marketplace.read`, `marketplace.write`, `audit.read` (consulter le journal d’audit de la ferme). Le wildcard `finance.*` satisfait `finance.read` et `finance.write`. Les invitations peuvent preciser des `scopes` pour restreindre le nouveau membre ; un **worker** sans `audit.read` ne voit pas les logs d’audit (proprietaire et `manager` ont `*`).

## API protegee (meme header Bearer)

| Methode | Chemin | Role |
|---------|--------|------|
| GET | `/api/v1/auth/me` | Session, profils, profil actif si `X-Profile-Id` |
| POST | `/api/v1/profiles` | Creer un profil (`producer`, `technician`, etc.) |
| PATCH | `/api/v1/profiles/:id` | `displayName`, `isDefault` |
| DELETE | `/api/v1/profiles/:id` | Supprimer (sauf acheteur par defaut) |
| POST | `/api/v1/farms` | Creer une ferme (`X-Profile-Id` = profil **producer**). Optionnel : `livestockMode` (`individual`, `batch`, `hybrid`) et `livestockCategoryPolicies` (JSON, ex. hybride par categorie) — voir `docs/LIVESTOCK_MODES_AND_HOUSING.md` |
| GET | `/api/v1/farms` | Lister fermes (proprietaire ou membre) |
| GET | `/api/v1/farms/:farmId/audit-logs?limit=&cursor=` | Journal d’audit de la ferme ; scope **`audit.read`** ; pagination : `cursor` = `id` de la derniere entree de la page precedente |
| GET | `/api/v1/farms/:id` | Detail si acces |
| POST | `/api/v1/farms/:farmId/transfer-ownership` | Transfert de propriete : corps `{ "newOwnerUserId": "<User.id>" }`. Reserve au **`ownerId`** actuel. Le futur proprietaire doit **deja etre membre** de la ferme ; ses lignes `FarmMembership` multiples sont fusionnees (une conservee en `owner`). L ancien proprietaire recoit le role **`manager`** (scopes par defaut). |
| GET | `/api/v1/farms/:farmId/members` | Liste des membres (`FarmMembership` + profil utilisateur) ; tout membre de la ferme |
| PATCH | `/api/v1/farms/:farmId/members/:membershipId` | Mettre a jour `role` (sauf `owner`) et/ou `scopes` ; scope **`invitations.manage`** ; pas de modification de la ligne **proprietaire** |
| DELETE | `/api/v1/farms/:farmId/members/:membershipId` | Retirer un membre (**`invitations.manage`**) ou **quitter la ferme** soi-meme (interdit si tu es `ownerId` de la ferme) |
| POST | `/api/v1/farms/:farmId/invitations` | Inviter : scope **`invitations.manage`** (inclus dans le defaut `manager` / `*`). Corps: `role` (pas `owner`), `scopes?`, `inviteeEmail?`, `inviteePhone?`. Reponse: **`token`** a transmettre au invite |
| POST | `/api/v1/invitations/accept` | Corps: `{ "token": "..." }`. Ajoute `FarmMembership`; une invitation ne s'utilise qu'une fois |

## Marketplace (annonces et offres)

Toutes les routes : `Authorization: Bearer` Supabase. Les annonces **brouillon** (`draft`) ne sont visibles que par le vendeur. Pour acheter, l'annonce doit etre **`published`**. Une offre **acceptee** passe l'annonce en **`sold`** et rejette les autres offres en **`pending`**.

**RBAC ferme (annonces liees au cheptel)** : si l'annonce a un `farmId` (directement ou via un `animalId`), le vendeur doit avoir le scope **`marketplace.write`** sur cette ferme pour **creer** le brouillon, **modifier**, **publier**, **annuler**, et pour **accepter / refuser** des offres. Les annonces sans `farmId` (pas de lien avec une ferme) ne passent pas par ce controle. Par defaut : `worker` a `marketplace.read` + `marketplace.write` ; `viewer` et `veterinarian` ont `marketplace.read` seulement. **Proposer une offre** ou **retirer sa offre** reste ouvert a tout utilisateur authentifie (y compris sans membership ferme).

| Methode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/v1/marketplace/listings?mine=true&status=` | Mes annonces (`mine`) ; `status` optionnel (`draft`, `published`, `reserved`, `sold`, `cancelled`) |
| GET | `/api/v1/marketplace/listings` | Fil public : defaut `published` ; autre `status` possible sauf `draft` (les brouillons restent prives, `mine=true`) |
| POST | `/api/v1/marketplace/listings` | Creer brouillon (`farmId?`, `animalId?`, `title`, `description?`, `unitPrice?`, `quantity?`, `currency?`, `locationLabel?`) ; acces ferme requis si refs |
| GET | `/api/v1/marketplace/listings/:id` | Detail ; vendeur voit toutes les offres, acheteur voit seulement **`myOffers`** |
| PATCH | `/api/v1/marketplace/listings/:id` | Mise a jour vendeur ; si `farmId` sur l'annonce : **`marketplace.write`** |
| POST | `/api/v1/marketplace/listings/:id/publish` | Publier ; idem si annonce liee ferme |
| POST | `/api/v1/marketplace/listings/:id/cancel` | Annuler (rejette les offres `pending`) ; idem si annonce liee ferme |
| GET | `/api/v1/marketplace/offers` | Mes offres en tant qu'acheteur |
| POST | `/api/v1/marketplace/listings/:listingId/offers` | Proposer (`offeredPrice`, `quantity?`, `message?`) — pas sur sa propre annonce |
| POST | `/api/v1/marketplace/listings/:listingId/offers/:offerId/accept` | Vendeur : accepter ; si annonce liee ferme : **`marketplace.write`** |
| POST | `/api/v1/marketplace/listings/:listingId/offers/:offerId/reject` | Vendeur : refuser ; idem |
| POST | `/api/v1/marketplace/offers/:offerId/withdraw` | Acheteur : retirer une offre `pending` |

## Elevage (animaux) — MVP porcin

Acces : membre de la ferme ou proprietaire (`Bearer` Supabase). L'espece **porcin** est cree automatiquement si absente (`code` `porcin`).

| Methode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/v1/taxonomy/species` | Liste especes + races (formulaires) |
| GET | `/api/v1/farms/:farmId/animals` | Liste animaux + derniere pesee |
| POST | `/api/v1/farms/:farmId/animals` | Creer (corps: `speciesId?`, `breedId?`, `tagCode?`, `sex?`, `birthDate?`, `notes?`) |
| GET | `/api/v1/farms/:farmId/animals/:animalId` | Detail + 30 dernieres pesees |
| PATCH | `/api/v1/farms/:farmId/animals/:animalId` | Mise a jour partielle |
| DELETE | `/api/v1/farms/:farmId/animals/:animalId` | Suppression (cascade pesees) |
| POST | `/api/v1/farms/:farmId/animals/:animalId/weights` | Ajouter pesee (`weightKg`, `measuredAt?`, `note?`) |

### Bandes (`LivestockBatch`)

Suivi par lot (effectif, poids moyen par tete, sante collective). Meme acces ferme que les animaux.

| Methode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/v1/farms/:farmId/batches` | Liste bandes + derniere pesee moyenne |
| POST | `/api/v1/farms/:farmId/batches` | Creer (`name`, `speciesId?`, `breedId?`, `categoryKey?`, `headcount?`, `avgBirthDate?`, `sourceTag?`, `notes?`) |
| GET | `/api/v1/farms/:farmId/batches/:batchId` | Detail + 30 pesees + 30 evenements sante |
| PATCH | `/api/v1/farms/:farmId/batches/:batchId` | MAJ partielle (`name`, `headcount`, `status`, etc.) |
| DELETE | `/api/v1/farms/:farmId/batches/:batchId` | Suppression (cascade pesees / sante bande) |
| POST | `/api/v1/farms/:farmId/batches/:batchId/weights` | Pesee moyenne (`avgWeightKg`, `headcountSnapshot?`, `measuredAt?`, `note?`) |
| GET | `/api/v1/farms/:farmId/batches/:batchId/health-events` | Historique sante collectif |
| POST | `/api/v1/farms/:farmId/batches/:batchId/health-events` | Idem champs que sante animal (`severity`, `title`, `body?`, `recordedAt?`) |

`publicId` sur chaque animal ou bande sert de reference stable (QR / partage). Les **races** s'ajoutent en base (Prisma Studio, seed ou future API admin) liees a une `Species`.

### Batiments & loges (`Barn`, `Pen`)

Structure : **batiment** → **loges** (zone libre via `zoneLabel` sur la loge). Occupation : **animal** *ou* **bande** ; historique via `PenPlacement` (`startedAt` / `endedAt`). Journal loge : nettoyage, desinfection, mortalite, traitement (`PenLog`). Deplacement : `POST pen-move` ferme le placement actif sur la ferme (ou sur `fromPenId`) et ouvre sur `toPenId`.

| Methode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/v1/farms/:farmId/barns` | Liste batiments (+ nombre de loges) |
| POST | `/api/v1/farms/:farmId/barns` | Creer (`name`, `code?`, `notes?`, `sortOrder?`) |
| GET | `/api/v1/farms/:farmId/barns/:barnId` | Detail + loges (+ compteur occupations actives par loge) |
| PATCH | `/api/v1/farms/:farmId/barns/:barnId` | MAJ |
| DELETE | `/api/v1/farms/:farmId/barns/:barnId` | Suppression (cascade loges, placements, journaux) |
| GET | `/api/v1/farms/:farmId/barns/:barnId/pens` | Liste loges du batiment |
| POST | `/api/v1/farms/:farmId/barns/:barnId/pens` | Creer loge (`name`, `code?`, `zoneLabel?`, `capacity?`, `status?`, `sortOrder?`) |
| GET | `/api/v1/farms/:farmId/pens/:penId` | Detail loge + occupants actifs + 20 derniers journaux |
| PATCH | `/api/v1/farms/:farmId/pens/:penId` | MAJ loge |
| DELETE | `/api/v1/farms/:farmId/pens/:penId` | Supprimer loge |
| GET | `/api/v1/farms/:farmId/pens/:penId/placements?activeOnly=true` | Historique d'occupation (defaut : actifs + recents) |
| POST | `/api/v1/farms/:farmId/pens/:penId/placements` | Affecter : exactement `animalId` **ou** `batchId` (ferme les autres placements actifs du sujet sur cette ferme) |
| POST | `/api/v1/farms/:farmId/pens/:penId/placements/end` | Terminer occupation (`animalId` ou `batchId`) |
| POST | `/api/v1/farms/:farmId/pen-move` | Deplacer : `toPenId`, `animalId` ou `batchId`, `fromPenId?`, `note?` |
| GET | `/api/v1/farms/:farmId/pens/:penId/logs` | Journal loge |
| POST | `/api/v1/farms/:farmId/pens/:penId/logs` | Entree journal (`type`: `cleaning`, `disinfection`, `mortality`, `treatment`, `other`, `title`, `body?`, `recordedAt?`) |

### Sorties de cheptel (`LivestockExit`)

Enregistrement structure : **vente**, **mortalite**, **abattage**, **transfert**. Sujet : exactement **`animalId`** ou **`batchId`**. **Animal** : `status` passe a `sold` / `dead` / `slaughtered` / `transferred` et les placements loge actifs sur cette ferme sont clotures. **Bande** : `headcountAffected` (defaut = effectif actuel) ; effectif diminue ; si 0, `status` = `closed` et placements bande clotures.

| Methode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/v1/farms/:farmId/exits?kind=&from=&to=` | Liste (200 derniers) ; `kind` : `sale`, `mortality`, `slaughter`, `transfer` ; dates ISO |
| POST | `/api/v1/farms/:farmId/exits` | Creer (`kind`, `animalId` ou `batchId`, `headcountAffected?`, `occurredAt?`, champs optionnels vente : `buyerName`, `price`, `currency?`, `weightKg`, `invoiceRef` ; mortalite : `deathCause`, `symptoms` ; abattage : `carcassYieldNote`, `slaughterDestination` ; transfert : `transferDestination`, `toFarmId?`, `note?`) |
| GET | `/api/v1/farms/:farmId/exits/:id` | Detail |

Synchroniser le schema apres toute evolution Prisma (fermes, invitations, elevage, etc.) :

```bash
npm run prisma:push --workspace @fermier/api
```

## Chat temps reel (REST + Socket.IO)

- **Salon ferme** : une piece par ferme (`ChatRoom` liee a `farmId`) ; acces si membre ou proprietaire (meme regle que `FarmAccessService`).
- **Salon direct** : entre deux utilisateurs Prisma (`directKey` stable) ; tout utilisateur existant peut ouvrir une conversation avec un autre par `peerUserId`.

### REST (`Authorization: Bearer` obligatoire)

| Methode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/v1/chat/rooms` | Salons dont je suis membre |
| POST | `/api/v1/chat/rooms/farm/:farmId` | Obtenir / creer le salon de la ferme et m’y ajouter |
| POST | `/api/v1/chat/rooms/direct` | Corps : `{ "peerUserId": "..." }` — salon 1:1 |
| GET | `/api/v1/chat/rooms/:roomId` | Detail salon (membres, ferme si applicable, dernier message) |
| GET | `/api/v1/chat/rooms/:roomId/messages?cursor=&take=` | Historique (pagination par `cursor` = id du message le plus ancien deja charge) |
| POST | `/api/v1/chat/rooms/:roomId/messages` | Envoyer : `{ "body": "..." }` (notifie aussi les clients WS du salon) |

### WebSocket (namespace `/chat`)

URL Socket.IO : meme hote que l’API, **namespace** ` /chat ` (ex. `io(baseUrl + "/chat", { auth: { token: access_token } })` ou en-tete `Authorization: Bearer ...` sur le handshake).

| Evenement client -> serveur | Corps | Effet |
|-----------------------------|-------|--------|
| `joinRoom` | `{ roomId }` | Rejoindre la room Socket (`room:<id>`) si membre |
| `leaveRoom` | `{ roomId }` | Quitter la room Socket |
| `sendMessage` | `{ roomId, body }` | Persiste + diffuse `newMessage` a la room |

Evenement **serveur -> client** : `newMessage` (payload message avec `sender`).

## MVP operations — taches, finance, sante (animaux)

Meme regle d'acces : **membre de la ferme ou proprietaire** + `Bearer` Supabase.

### Taches (`FarmTask`)

| Methode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/v1/farms/:farmId/tasks?status=todo` | Liste (`status` optionnel : `todo`, `in_progress`, `done`, `cancelled`) |
| POST | `/api/v1/farms/:farmId/tasks` | Creer (`title`, `description?`, `category?`, `priority?`, `status?`, `dueAt?`, `assignedUserId?`) |
| PATCH | `/api/v1/farms/:farmId/tasks/:taskId` | MAJ (completion auto si `status=done`) |
| DELETE | `/api/v1/farms/:farmId/tasks/:taskId` | Supprimer |

L'assigne doit etre **membre de la ferme** (ou proprietaire).

### Finance (depenses / revenus)

| Methode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/v1/farms/:farmId/finance/summary?from=&to=` | Totaux depenses, revenus, net (MVP : devise affichee `XOF` ; tout melange si plusieurs devises en base) |
| GET | `/api/v1/farms/:farmId/finance/expenses?from=&to=` | Liste depenses |
| GET | `/api/v1/farms/:farmId/finance/expenses/:expenseId` | Detail + createur ; **`finance.read`** |
| POST | `/api/v1/farms/:farmId/finance/expenses` | `amount`, `label`, `currency?` (defaut `XOF`), `category?`, `note?`, `occurredAt?` ; scope **`finance.write`** |
| PATCH | `/api/v1/farms/:farmId/finance/expenses/:expenseId` | MAJ partielle (memes champs que creation, tous optionnels) ; **`finance.write`** |
| DELETE | `/api/v1/farms/:farmId/finance/expenses/:expenseId` | Suppression ; **`finance.write`** |
| GET | `/api/v1/farms/:farmId/finance/revenues?from=&to=` | Liste revenus |
| GET | `/api/v1/farms/:farmId/finance/revenues/:revenueId` | Detail + createur ; **`finance.read`** |
| POST | `/api/v1/farms/:farmId/finance/revenues` | Idem structure depense ; **`finance.write`** |
| PATCH | `/api/v1/farms/:farmId/finance/revenues/:revenueId` | MAJ partielle ; **`finance.write`** |
| DELETE | `/api/v1/farms/:farmId/finance/revenues/:revenueId` | Suppression ; **`finance.write`** |

### Sante — evenements par animal

| Methode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/v1/farms/:farmId/animals/:animalId/health-events` | Historique |
| POST | `/api/v1/farms/:farmId/animals/:animalId/health-events` | `severity` : `info`, `watch`, `urgent` ; `title` ; `body?` ; `recordedAt?` |

### Consultations veterinaires (dossier + pieces jointes)

Cas structurés par ferme ; **photo / PDF** : l’app uploade d’abord vers le stockage (ex. bucket Supabase), puis envoie l’**URL** en pièce jointe. Accès : membre ou propriétaire de la ferme.

| Methode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/v1/farms/:farmId/vet-consultations?status=` | Liste ; `status` optionnel : `open`, `in_progress`, `resolved`, `cancelled` |
| POST | `/api/v1/farms/:farmId/vet-consultations` | Ouvrir (`subject`, `summary?`, `animalId?`) |
| GET | `/api/v1/farms/:farmId/vet-consultations/:id` | Detail + pieces jointes |
| PATCH | `/api/v1/farms/:farmId/vet-consultations/:id` | `subject?`, `summary?`, `status?`, `primaryVetUserId?` (null pour retirer) ; `resolved` / `cancelled` renseignent `closedAt` |
| POST | `/api/v1/farms/:farmId/vet-consultations/:id/attachments` | Ajouter (`url`, `mimeType?`, `label?`) |

## Modele de donnees

- `User.supabaseUserId` : identifiant `auth.users.id` (UUID).
- `email` / `phone` : optionnels selon le fournisseur (telephone seul possible).
- Unicite : `email` et `phone` uniques quand renseignes.

## Migration depuis une ancienne table `User`

Si tu avais deja des lignes sans `supabaseUserId`, Prisma peut demander une confirmation. En **developpement** sans donnees a conserver :

```bash
npm run prisma:push:force --workspace @fermier/api
```

Sinon : migrer les donnees ou vider `User` avant `npm run prisma:push --workspace @fermier/api`.
