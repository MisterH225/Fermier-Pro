# Authentification Supabase (Google, Apple, telephone)

Pour la **vision sécurité globale** (multi-tenant, RBAC, audit, marketplace, conformité), voir **`docs/SECURITY_ARCHITECTURE.md`**.

L'API Nest verifie le **JWT access** emis par Supabase (`HS256` avec le **JWT Secret** du projet). Le mobile (Expo) utilise `@supabase/supabase-js` pour les flux OAuth / OTP ; le backend ne gere pas les ecrans de login, seulement `GET /api/v1/auth/me` avec `Authorization: Bearer <access_token>`.

## Variables d'environnement (racine `.env`)

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_JWT_SECRET=<optionnel, tests e2e HS256 uniquement>
```

- `SUPABASE_URL` : **obligatoire** pour l'API Nest. Les jetons utilisateur (Google, SMS) sont signés en **ES256** ; l'API les verifie via `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`.
- `SUPABASE_JWT_SECRET` : **ne pas** y mettre le **Key ID** affiche dans Authentication → JWT Keys. Reserve ce champ aux tests e2e locaux (HS256) si besoin. L'ancien « JWT Secret » legacy (Settings → API) ne s'applique qu'aux projets encore en HS256.

## Configuration dashboard Supabase

1. **Authentication -> Providers**
   - **Google** : activer, renseigner Client ID / Secret (console Google Cloud OAuth).
   - **Apple** : activer pour *Sign in with Apple* (compte developpeur Apple, Service ID, cle privee).
   - **Phone** : activer. Pour **Yellika SMS** (recommandé CI/UEMOA), utiliser le hook **Send SMS** HTTP (voir section ci-dessous) plutôt que le fournisseur SMS intégré Supabase (Twilio).

### Activer l'inscription par téléphone (checklist Yellika)

1. **Yellika SMS** (panel → [Developers / API](https://panel.yellikasms.com/developers/docs))
   - Copier le **token API** → `YELLIKA_SMS_API_TOKEN` (Railway, service API)
   - Copier le **sender ID approuvé** → `YELLIKA_SMS_SENDER_ID` (ex. nom alphanumérique validé par Yellika)
   - Optionnel : `YELLIKA_SMS_APP_NAME=Fermier Pro` (préfixe du SMS OTP)
   - Endpoint : copier l’URL POST **complète** de la doc Yellika dans `YELLIKA_SMS_SEND_URL` (ex. `https://panel.yellikasms.com/api/v3/sms/send`) — le client **n’ajoute aucun suffixe**

2. **Supabase → Authentication → Hooks → Send SMS**
   - Type : **HTTP**
   - URL : `https://fermierapi-production.up.railway.app/api/v1/webhooks/supabase/send-sms` (ou votre URL API)
   - Secret : copier `v1,whsec_...` → `SUPABASE_SEND_SMS_HOOK_SECRET` sur Railway
   - Désactiver le fournisseur SMS par défaut de Supabase si vous utilisez uniquement Yellika

3. **Supabase → Authentication → Providers → Phone**
   - Activer **Phone**
   - Laisser Supabase générer l'OTP (le hook Nest envoie le SMS via Yellika)

4. **Vérifier le déploiement API**
   ```bash
   curl -s https://<api>/api/v1/health | jq .phoneAuth
   ```
   Attendu : `"ready": true` et `"missing": []`.

5. **Mobile** : aucune clé Yellika côté app — l'utilisateur saisit son numéro sur `PhoneOtpAuth`, Supabase crée le compte à la première vérification OTP, puis `GET /auth/me` synchronise l'utilisateur Prisma et affiche le choix de profil.

2. **Authentication -> Hooks -> Send SMS** (Yellika SMS)
   - Type : **HTTP**
   - URL : `https://<votre-api>/api/v1/webhooks/supabase/send-sms`
   - Secret : copier la valeur `v1,whsec_...` dans `SUPABASE_SEND_SMS_HOOK_SECRET` (API Railway)
   - Supabase génère l'OTP ; l'API Nest l'envoie via Yellika (`POST /api/v3/sms/send`)
- Le webhook doit répondre **HTTP 200** (Nest renvoie 201 par défaut sur POST sans `@HttpCode(200)`)
- En cas d'échec Yellika, l'API répond **200** avec `{ "error": { "message": "...", "http_code": 503 } }` — message propagé à l'app mobile (éviter HTTP 503 brut qui provoque « Service currently unavailable due to hook »)
- En cas d'échec Yellika, vérifier `YELLIKA_SMS_API_TOKEN`, `YELLIKA_SMS_SENDER_ID` et le solde Yellika sur Railway
- Yellika renvoie souvent HTTP 200 avec `{"status":"error","message":"..."}` (ex. token invalide → `Unauthenticated.`)

3. **Authentication -> URL configuration** (indispensable pour Google sur téléphone)
   - **Site URL** : l’URL `exp://<IP-LAN>:8081/--/auth/callback` affichée sur l’écran de connexion mobile (Expo Go), ou `fermier-pro://auth/callback` en build natif. **Ne pas** laisser `http://localhost:3000` si tu testes sur iPhone physique — Safari tentera d’ouvrir localhost sur le téléphone et échouera.
   - **Redirect URLs** : ajouter **exactement** l’URL affichée sur l’écran de connexion mobile en dev (`exp://…/--/auth/callback`) **et** `fermier-pro://auth/callback` pour les builds natifs (preview, TestFlight, APK). Sans cela, Supabase retombe sur Site URL (souvent localhost).
   - Tu peux garder `http://localhost:3000` en Redirect URL **en plus** si tu développes aussi une app web.

4. **Ne pas** s'appuyer sur `user_metadata` pour des decisions d'autorisation sensibles cote RLS : preferer `app_metadata` pour les roles serveur. Ici Nest synchronise seulement profil basique (email, telephone, nom) dans la table `User` Prisma.

## Storage (photos mobile)

L’app téléverse des fichiers via la clé **anon** + session utilisateur (`@supabase/supabase-js`) :

| Bucket | Usage | Chemin type |
|--------|--------|-------------|
| **`avatars`** | Photo de profil par rôle (producteur, vétérinaire, technicien…) | `{auth.users.id}/{profileType}/avatar.jpg` (legacy : `{id}/avatar.jpg`) |
| **`vet-credentials`** | Diplôme vétérinaire (onboarding) | `diplomas/{auth.users.id}/…` |
| **`finance-proofs`** | Preuve photo dépense / revenu | `farms/{farmId}/…` |

Si l’enregistrement affiche **`Bucket not found`**, le bucket n’existe pas encore sur le projet Supabase.

**Création (une fois par projet)** :

1. Dashboard Supabase → **SQL Editor** → New query.
2. Ouvrir le fichier `supabase/migrations/20260519120000_storage_buckets.sql` dans l’éditeur de code, **copier tout son contenu SQL** (les lignes `INSERT`, `CREATE POLICY`, etc.) — **ne pas** coller le chemin du fichier dans Supabase.
3. Coller ce SQL dans l’éditeur Supabase et cliquer **Run** (crée les deux buckets publics + politiques RLS).
3. Exécuter aussi `supabase/migrations/20260523140000_vet_credentials_bucket.sql` pour l’onboarding vétérinaire.
4. Vérifier dans **Storage** que `avatars`, `vet-credentials` et `finance-proofs` apparaissent.
5. Relancer l’app (Expo) et réessayer l’upload.

Alternative manuelle : **Storage → New bucket** → nom `avatars`, cocher **Public bucket**, MIME images ; répéter pour `finance-proofs`.

## Mobile (Expo) — flux recommandes

- **Config** : dans `apps/mobile/`, fichier `.env` (voir `.env.example`) avec `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`. Client partagé : `apps/mobile/src/lib/supabase.ts` (`@supabase/supabase-js` + `AsyncStorage`) ; appel API typé : `src/lib/api.ts` (`fetchAuthMe`).
- **OTP SMS dans l app** : ecran `PhoneOtpAuth` (`signInWithOtp` + `verifyOtp`, format E.164 obligatoire).
- **Google** : `signInWithOAuth` + `WebBrowser.openAuthSessionAsync`, puis `exchangeCodeForSession` avec le `code` PKCE dans l’URL de retour (`googleAuth.ts`). Redirect : `fermier-pro://auth/callback` (build natif) ou `exp://…/--/auth/callback` (Expo Go).
- **Apple** : `signInWithOAuth({ provider: 'apple', ... })` sur iOS.
- **Telephone** : `signInWithOtp({ phone, options: { channel: 'sms' } })` puis verification du code. L'envoi SMS passe par le hook **Send SMS** → **Yellika SMS** si configure (variables `YELLIKA_SMS_*` + `SUPABASE_SEND_SMS_HOOK_SECRET`).

Apres `session.access_token`, appeler :

```http
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

La premiere requete cree ou met a jour l'utilisateur Prisma (`supabaseUserId` = `sub` du JWT). **Aucun profil n'est cree automatiquement** : le mobile affiche `FirstConnectionProfileScreen` puis `POST /profiles`.

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
