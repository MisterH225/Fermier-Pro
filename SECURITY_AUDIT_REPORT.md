# Rapport d'audit de sécurité — Fermier Pro

**Date :** 7 juin 2026  
**Périmètre :** `apps/mobile` (Expo/React Native), `apps/api` (NestJS/Prisma), `apps/admin-platform` (Next.js), Supabase (Auth, Postgres, Storage)  
**Type :** Revue offensive statique (code + configuration versionnée)  
**Auditeur :** Analyse automatisée Cursor (lecture seule, aucune modification de code)

---

## Résumé exécutif

| Indicateur | Valeur |
|------------|--------|
| **Niveau de risque global** | **CRITIQUE** |
| **Verdict lancement prod (paiements / escrow)** | **NON PRÊT** |
| **Verdict lancement prod (hors paiements)** | **CONDITIONNEL** (correctifs High requis) |
| Findings Critiques | 12 |
| Findings High | 14 |
| Findings Medium | 18 |
| Findings Low / Info | 12 |

Fermier Pro dispose d'une architecture de sécurité **conceptuellement solide** (JWT Supabase, guards NestJS, scopes par ferme, commission figée côté serveur, contrôles PigPrice anti-manipulation, throttle global). En revanche, la **couche financière est encore en mode développement** : gateway mobile money simulé, confirmation de paiement pilotée par le client, absence de webhooks signés, et conditions de course sur le règlement escrow. Combiné au stockage des tokens en AsyncStorage, à l'absence de RLS Postgres, et à des politiques Storage permissives, l'application **ne doit pas traiter de fonds réels** avant correction des findings Critiques.

**Priorité absolue avant trafic production :** escrow/paiements, webhooks MM, verrouillages transactionnels, SecureStore, RLS Storage, blocage modification annonce en escrow.

---

## Méthodologie

Chaque contrôle de la spec d'audit a été évalué en **PASS**, **FAIL** ou **CANNOT_DETERMINE** via :

- Lecture systématique du code source et des migrations Supabase
- `npm audit --audit-level=high` sur `apps/api` et `apps/mobile`
- Recherche grep (`$queryRaw`, secrets, SecureStore, RLS, webhooks, etc.)

**Limites :** configuration Supabase Auth (durée JWT, rate limit OTP) non visible dans le dépôt ; comportement Railway prod ; tests d'intrusion dynamiques non réalisés ; RLS Postgres non testée par appels directs à l'API Supabase PostgREST.

---

## Findings CRITIQUES

> Exploitables ou bloquants avant tout trafic production impliquant des fonds.

---

### C-01 — Gateway mobile money de développement en production de code

| Champ | Détail |
|-------|--------|
| **Domaine** | Paiement / Escrow |
| **Statut** | **FAIL** |
| **Fichiers** | `apps/api/src/marketplace/marketplace.module.ts`, `apps/api/src/vet-appointments/vet-appointments.module.ts`, `apps/api/src/marketplace/escrow/dev-mobile-money.gateway.ts` |
| **Description** | Le provider `MOBILE_MONEY_GATEWAY` est toujours `DevMobileMoneyGateway` (état en mémoire, confirmations simulées sans opérateur réel). |
| **Reproduction** | Acheteur authentifié appelle `POST /marketplace/transactions/:id/payment/confirm` → statut `PAYMENT_HELD` sans débit réel. |
| **Impact** | Escrow entièrement contournable ; fonds fictifs ; fausse confiance vendeur/acheteur. |
| **Correctif recommandé** | Implémenter un gateway production (Orange/MTN/Wave) ; brancher via factory env (`MOBILE_MONEY_PROVIDER=wave`) ; interdire `DevMobileMoneyGateway` si `NODE_ENV=production`. |

---

### C-02 — Confirmation de paiement pilotée par le client (pas de webhook provider)

| Champ | Détail |
|-------|--------|
| **Domaine** | Paiement / Escrow |
| **Statut** | **FAIL** |
| **Fichiers** | `apps/api/src/marketplace/escrow/marketplace-transaction.controller.ts` (~L42-48), `marketplace-transaction.service.ts` (L148-164), `vet-appointment.service.ts` (L518-533) |
| **Description** | Aucun endpoint webhook mobile money dans `apps/api/src`. La transition `PAYMENT_PENDING → PAYMENT_HELD` dépend d'un appel REST initié par l'acheteur, pas d'une confirmation asynchrone signée du provider. |
| **Reproduction** | Appeler `payment/confirm` après `initiatePayment` sans interaction opérateur (dev gateway retourne `success: true`). |
| **Impact** | Fraude paiement ; non-conformité aux pratiques MM en Afrique de l'Ouest. |
| **Correctif recommandé** | Webhook HMAC signé comme source de vérité ; endpoint client = polling ou idempotent replay uniquement ; rejeter confirm sans statut provider `SUCCESS`. |

```typescript
// Pattern recommandé
@Post('webhooks/mobile-money')
async handleWebhook(@Headers('x-signature') sig: string, @Body() body: ProviderEvent) {
  if (!this.gateway.verifySignature(sig, body)) throw new UnauthorizedException();
  await this.escrowService.applyProviderEvent(body); // idempotent par providerRef
}
```

---

### C-03 — `providerRef` non lié à la transaction (confirmation croisée)

| Champ | Détail |
|-------|--------|
| **Domaine** | Paiement / Escrow |
| **Statut** | **FAIL** |
| **Fichiers** | `marketplace-transaction.service.ts` (L153-157), `dev-mobile-money.gateway.ts` (L43-49) |
| **Description** | `confirmPayment(user, transactionId, providerRef?)` accepte une ref arbitraire. Le gateway dev confirme toute ref pending valide sans vérifier qu'elle appartient à `transactionId`. |
| **Reproduction** | Acheteur A initie paiement (ref R1). Acheteur B confirme transaction B avec `providerRef=R1`. |
| **Impact** | Déblocage escrow sans paiement propre ; vol de confirmation. |
| **Correctif recommandé** | Stocker `transactionId` dans le gateway ; `confirmHold(ref, expectedTxId)` ; rejeter mismatch. |

---

### C-04 — Race condition sur `settleTransaction` (double règlement)

| Champ | Détail |
|-------|--------|
| **Domaine** | Paiement / Escrow |
| **Statut** | **FAIL** |
| **Fichiers** | `marketplace-transaction.service.ts` (L498-596, L267-281, L464-494), `marketplace-transaction.cron.ts` |
| **Description** | `settleTransaction` lit `WEIGHT_VALIDATED` sans lock ni `updateMany` conditionnel. Appelé depuis validation manuelle, arbitrage admin, et cron auto-24h. Opérations gateway **avant** la transaction Prisma de clôture. |
| **Reproduction** | Deux requêtes/cron concurrents sur même `transactionId` → double `refundBuyer` / `releaseFundsToSeller`. |
| **Impact** | Double versement ou double remboursement ; perte plateforme. |
| **Correctif recommandé** | Transition optimiste : `updateMany({ where: { id, status: WEIGHT_VALIDATED }})` → si count=0, return idempotent ; **puis** gateway ; advisory lock Postgres pour cron multi-instance. |

```typescript
const updated = await prisma.marketplaceTransaction.updateMany({
  where: { id: transactionId, status: 'WEIGHT_VALIDATED' },
  data: { status: 'SETTLING' },
});
if (updated.count === 0) return; // déjà en cours ou clos
// ops gateway...
await prisma.marketplaceTransaction.update({ where: { id }, data: { status: 'TRANSACTION_CLOSED' } });
```

---

### C-05 — Opérations financières hors transaction Prisma atomique

| Champ | Détail |
|-------|--------|
| **Domaine** | Paiement / Escrow |
| **Statut** | **FAIL** |
| **Fichiers** | `marketplace-transaction.service.ts` (L516-596), `escrow.service.ts` |
| **Description** | `chargeAdditional`, `refundBuyer`, `releaseFundsToSeller`, `collectCommission` s'exécutent avant le `$transaction` Prisma qui passe à `TRANSACTION_CLOSED` et crée `platform_revenue`. |
| **Reproduction** | Crash API entre appel gateway et update DB → fonds mouvementés, transaction toujours `WEIGHT_VALIDATED` ; retry → double mouvement. |
| **Impact** | Incohérence ledger/état ; double payout au retry. |
| **Correctif recommandé** | Pattern saga : statut intermédiaire `SETTLING` + idempotency keys gateway + reconciliation job. |

---

### C-06 — Versement vendeur marketplace sans appel gateway réel

| Champ | Détail |
|-------|--------|
| **Domaine** | Paiement / Escrow |
| **Statut** | **FAIL** |
| **Fichiers** | `escrow.service.ts` (L45-58) vs `vet-appointment.service.ts` (L645-652) |
| **Description** | `releaseFundsToSeller` ne fait qu'un `logMovement` DB. `MobileMoneyGateway.releaseFunds` existe mais n'est pas appelé pour le marketplace (contrairement aux RDV vet). |
| **Impact** | En prod réelle, vendeur marketplace jamais payé malgré clôture ; asymétrie vet/marketplace. |
| **Correctif recommandé** | Appeler `gateway.releaseFunds({ sellerUserId, amount, transactionId })` avec même pattern que vet. |

---

### C-07 — Tokens Supabase en AsyncStorage (plaintext)

| Champ | Détail |
|-------|--------|
| **Domaine** | Auth mobile |
| **Statut** | **FAIL** |
| **Fichiers** | `apps/mobile/src/lib/supabase.ts` (L1, L26-30), `SessionContext.tsx` (L22, L109-143) |
| **Description** | Session Supabase (access + refresh tokens) persistée via `@react-native-async-storage/async-storage`. Aucun `expo-secure-store` dans le projet. |
| **Reproduction** | Appareil rooté/jailbreaké ou backup non chiffré → extraction tokens → usurpation session. |
| **Impact** | Accès compte, paiements, données santé/finance. |
| **Correctif recommandé** | Adapter Supabase storage vers SecureStore (Keychain/Keystore) ; chiffrer cache `auth_me` ou le retirer. |

```typescript
import * as SecureStore from 'expo-secure-store';
const storage = {
  getItem: (k) => SecureStore.getItemAsync(k),
  setItem: (k, v) => SecureStore.setItemAsync(k, v),
  removeItem: (k) => SecureStore.deleteItemAsync(k),
};
```

---

### C-08 — Absence de RLS sur les tables Postgres applicatives

| Champ | Détail |
|-------|--------|
| **Domaine** | Exposition données / Supabase |
| **Statut** | **FAIL** |
| **Fichiers** | `supabase/migrations/` (13 fichiers — aucun `ENABLE ROW LEVEL SECURITY` sur tables métier) |
| **Description** | Sécurité reposant uniquement sur NestJS + connexion Prisma privilégiée. Si PostgREST/Realtime/accès direct anon mal configuré, contournement possible. |
| **Impact** | Fuite masse données (fermes, santé, finance, transactions) si clé anon + endpoint Supabase exposé. |
| **Correctif recommandé** | RLS sur toutes tables `public` ; policies `auth.uid()` ; tests bypass PostgREST ; documenter que seul le backend écrit. |

---

### C-09 — Politiques Storage permissives (finance, photos, annonces)

| Champ | Détail |
|-------|--------|
| **Domaine** | Exposition données |
| **Statut** | **FAIL** |
| **Fichiers** | `supabase/migrations/20260519120000_storage_buckets.sql` (L74-88), `20260520130000_animal_photos_bucket.sql`, `20260530180000_listings_photos_bucket.sql` |
| **Description** | Tout utilisateur `authenticated` peut INSERT/UPDATE/DELETE sur **tout** le bucket (pas de restriction par préfixe `auth.uid()` sauf avatars). |
| **Reproduction** | Utilisateur A upload/supprime fichier dans le chemin de l'utilisateur B si URL/path deviné. |
| **Impact** | Suppression preuves finance ; remplacement photos annonce ; sabotage. |
| **Correctif recommandé** | Policies `(storage.foldername(name))[1] = auth.uid()::text` par bucket. |

---

### C-10 — Bucket vet-credentials public en lecture

| Champ | Détail |
|-------|--------|
| **Domaine** | Exposition données |
| **Statut** | **FAIL** |
| **Fichiers** | `supabase/migrations/20260523140000_vet_credentials_bucket.sql` (L6-8, L16-19) |
| **Description** | Bucket `public: true` + policy SELECT `TO public`. |
| **Impact** | Diplômes/certificats vétérinaires accessibles sans auth si URL connue. |
| **Correctif recommandé** | Bucket privé ; signed URLs via backend ; SELECT réservé admin/vet owner. |

---

### C-11 — Prix annonce modifiable pendant escrow actif

| Champ | Détail |
|-------|--------|
| **Domaine** | Logique métier / PigPrice |
| **Statut** | **FAIL** |
| **Fichiers** | `apps/api/src/marketplace/listings.service.ts` (L614-625), `marketplace-transaction.service.ts` (L180-183), `transaction.utils.ts` (`ACTIVE_ESCROW_STATUSES`) |
| **Description** | `update()` bloque `reserved/sold/cancelled` mais pas les annonces `published` avec transaction escrow active (`PAYMENT_HELD`, etc.). Acceptation offre ne passe pas l'annonce en `reserved`. |
| **Reproduction** | Vendeur accepte offre → acheteur paie → vendeur modifie `pricePerKg` / `totalPrice` via PATCH listing. |
| **Impact** | Manipulation PigPrice (poids 0.3 annonces publiées) ; confusion acheteur ; arbitrage incohérent. |
| **Correctif recommandé** | Avant update, vérifier absence de tx dans `ACTIVE_ESCROW_STATUSES` ; ou passer listing en `reserved` dès `PAYMENT_HELD`. |

---

### C-12 — Absence de webhooks mobile money (signature / réconciliation)

| Champ | Détail |
|-------|--------|
| **Domaine** | Paiement |
| **Statut** | **FAIL** |
| **Fichiers** | Recherche `webhook` dans `apps/api/src` → 0 résultat |
| **Description** | Aucune validation signature gateway, pas de réconciliation asynchrone. |
| **Impact** | Modèle de confiance client incompatible production MM. |
| **Correctif** | Voir C-02. |

---

## Findings HIGH

---

### H-01 — Comptes bannis/suspendus contournables hors `/auth/me`

| Champ | Détail |
|-------|--------|
| **Statut** | **FAIL** |
| **Fichiers** | `supabase-jwt.guard.ts` (L13-21), `optional-active-profile.guard.ts` (L22-41) — guard appliqué **uniquement** sur `auth.controller.ts` |
| **Description** | `SupabaseJwtGuard` ne vérifie pas `accountStatus`. La logique ban/suspend existe dans `OptionalActiveProfileGuard` mais n'est pas globale (`APP_GUARD` = ThrottlerGuard seulement). |
| **Impact** | Utilisateur banni continue d'appeler API avec JWT valide jusqu'à expiration. |
| **Correctif** | Enregistrer `OptionalActiveProfileGuard` (ou middleware ban) en `APP_GUARD` global après JWT. |

---

### H-02 — `confirmPayment` sans idempotence (double confirmation)

| Champ | Détail |
|-------|--------|
| **Statut** | **FAIL** |
| **Fichiers** | `marketplace-transaction.service.ts` (L148-184) |
| **Correctif** | `updateMany({ where: { id, status: PAYMENT_PENDING }})` ; retour idempotent si déjà `PAYMENT_HELD`. |

---

### H-03 — `cancelByBuyer` refund non atomique

| Champ | Détail |
|-------|--------|
| **Statut** | **FAIL** |
| **Fichiers** | `marketplace-transaction.service.ts` (L344-377) |
| **Description** | Refund gateway puis update statut ; pas de garde « déjà remboursé ». |
| **Correctif** | Transaction + statut intermédiaire `CANCELLING`. |

---

### H-04 — CORS WebSocket `origin: "*"`

| Champ | Détail |
|-------|--------|
| **Statut** | **FAIL** |
| **Fichiers** | `apps/api/src/chat/chat.gateway.ts` (~L17-19), `tasks.gateway.ts` (~L16-18) |
| **Impact** | Sites malveillants peuvent initier connexions cross-origin (JWT toujours requis à la connexion). |
| **Correctif** | Aligner sur `CORS_ORIGINS` du REST. |

---

### H-05 — Helmet absent (en-têtes HTTP sécurité)

| Champ | Détail |
|-------|--------|
| **Statut** | **FAIL** |
| **Fichiers** | `apps/api/src/main.ts`, `apps/api/package.json` |
| **Correctif** | `app.use(helmet())` ; CSP pour admin-platform. |

---

### H-06 — OAuth mobile flux implicit (tokens dans URL)

| Champ | Détail |
|-------|--------|
| **Statut** | **FAIL** |
| **Fichiers** | `apps/mobile/src/lib/supabase.ts` (L13-14), `googleAuth.ts` (L48-82) |
| **Description** | `flowType: "implicit"` natif ; tokens extraits du fragment URL. |
| **Impact** | Fuite tokens via logs/deep links/historique. |
| **Correctif** | PKCE natif Supabase ; `hostUri` production vérifié (partiellement OK : `fermier-pro://` L18-22 `googleAuth.ts`). |

---

### H-07 — IDOR lecture RDV vétérinaire (membres ferme)

| Champ | Détail |
|-------|--------|
| **Statut** | **FAIL** |
| **Fichiers** | `vet-appointment.service.ts` (L359-376) |
| **Description** | `getById` : tout membre ferme peut lire RDV (producteur, vet, notes, prix). |
| **Correctif** | Restreindre aux rôles producteur/vet concernés + scopes `vetRead`. |

---

### H-08 — Vet appointments sans FarmScopesGuard

| Champ | Détail |
|-------|--------|
| **Statut** | **FAIL** |
| **Fichiers** | `vet-appointment.controller.ts` (L19-37), `vet-appointment.service.ts` (L154-165) |
| **Correctif** | `@RequireFarmScopes('vetWrite')` ou équivalent. |

---

### H-09 — DTO inline sans class-validator

| Champ | Détail |
|-------|--------|
| **Statut** | **FAIL** |
| **Fichiers** | `vet-appointment.controller.ts`, `marketplace-transaction.controller.ts`, `gestation.controller.ts`, `farm-settings.controller.ts` |
| **Description** | `@Body() body: { ... }` bypass ValidationPipe. |
| **Correctif** | DTO classes avec `@IsString()`, `@Min()`, `@MaxLength()`. |

---

### H-10 — `adminManualRefund` sans garde statut / idempotence

| Champ | Détail |
|-------|--------|
| **Statut** | **FAIL** |
| **Fichiers** | `vet-appointment.service.ts` (L1020-1052) |
| **Impact** | Remboursements multiples sur même RDV. |
| **Correctif** | Vérifier statut ; journal audit ; idempotency key. |

---

### H-11 — Cron auto-validation poids sans lock distribué

| Champ | Détail |
|-------|--------|
| **Statut** | **FAIL** |
| **Fichiers** | `marketplace-transaction.cron.ts`, `marketplace-transaction.service.ts` (L464-494) |
| **Correctif** | Advisory lock Postgres ; singleton cron Railway. |

---

### H-12 — Secrets/config sensibles dans `eas.json` versionné

| Champ | Détail |
|-------|--------|
| **Statut** | **FAIL** (config) |
| **Fichiers** | `apps/mobile/eas.json` (L18-44) |
| **Description** | Anon key Supabase + Google OAuth client IDs en clair (anon key = public by design, mais rotation/exposition accrue). |
| **Correctif** | EAS Secrets ; retirer clés du repo ; rotation si historique git public. |

---

### H-13 — Cache auth/profil en AsyncStorage

| Champ | Détail |
|-------|--------|
| **Statut** | **FAIL** |
| **Fichiers** | `SessionContext.tsx`, `queryPersist.ts` |
| **Impact** | PII (email, statuts modération) extractibles. |
| **Correctif** | SecureStore ou pas de cache offline auth. |

---

### H-14 — Charge additionnelle poids > buffer bloque transaction

| Champ | Détail |
|-------|--------|
| **Statut** | **FAIL** |
| **Fichiers** | `transaction.utils.ts`, `marketplace-transaction.service.ts` (L516-525) |
| **Impact** | Transaction bloquée indéfiniment en `WEIGHT_VALIDATED` si poids > 110% estimé. |
| **Correctif** | Workflow litige / paiement complémentaire manuel / plafond négocié. |

---

## Findings MEDIUM

| ID | Domaine | Titre | Statut | Fichiers / notes |
|----|---------|-------|--------|------------------|
| M-01 | API | Pas de `forbidNonWhitelisted` sur ValidationPipe | FAIL | `main.ts` L25-29 |
| M-02 | API | Endpoints publics sans throttle | FAIL | `app.controller.ts`, `config-client.controller.ts` |
| M-03 | API | Ops internes protégées par secret partagé | FAIL* | `admin-vets.controller.ts`, `admin-pen-allocation.controller.ts` — dépend force secret |
| M-04 | API | Erreurs prod non configurées explicitement | CANNOT_DETERMINE | Pas de `ExceptionFilter` custom |
| M-05 | Auth | Rate limit login/OTP côté Supabase | CANNOT_DETERMINE | Auth directe Supabase, cooldown client 60s OTP |
| M-06 | Auth | Pas de 2FA / re-auth paiements | FAIL | Aucune step-up auth |
| M-07 | Auth | Session invalidation logout | PARTIAL | Supabase signOut mobile ; pas de révocation globale devices |
| M-08 | Mobile | Pas de certificate pinning | FAIL | Aucune implémentation |
| M-09 | Mobile | Pas de détection root/jailbreak | FAIL | Aucune implémentation |
| M-10 | Mobile | Deep link push navigation sans allowlist | FAIL | `DeepNavigationService.ts` L356-359 |
| M-11 | Admin | Cookie OAuth sans HttpOnly/Secure | FAIL | `admin-oauth.ts` L43 |
| M-12 | Escrow | Ré-initiation paiement écrase `paymentProviderRef` | FAIL | `marketplace-transaction.service.ts` L121-140 |
| M-13 | Escrow | Commission vet via env vs marketplace via DB | FAIL | `platform-settings.service.ts` vs `vet-appointment.service.ts` |
| M-14 | Escrow | `photoUrl` poids non validée (SSRF futur) | FAIL | `marketplace-transaction.service.ts` L255 |
| M-15 | Business | Montants `@Min(0)` autorisent zéro | FAIL | DTOs finance/marketplace |
| M-16 | Business | PigPrice — annonces publiées pondérées 0.3 | FAIL | Manipulation prix pendant escrow (C-11) |
| M-17 | Upload | Validation MIME/taille côté mobile absente | FAIL | `uploadFinanceProofToSupabase.ts`, etc. |
| M-18 | Infra | `SUPABASE_SERVICE_ROLE_KEY` absent `.env.example` | FAIL | Documentation incomplète |

---

## Findings LOW / Informationnel

| ID | Domaine | Titre | Statut |
|----|---------|-------|--------|
| L-01 | Auth | JWT expiry Supabase | **PASS** — `supabase-jwt.verifier.ts` |
| L-02 | Auth | JWT secret serveur uniquement | **PASS** — pas dans mobile |
| L-03 | Auth | Google redirect `fermier-pro://` en prod native | **PASS** — `googleAuth.ts` L18-22 |
| L-04 | Auth | Password policy | **CANNOT_DETERMINE** — OTP/Google only |
| L-05 | API | `$queryRaw` paramétré | **PASS** — tagged templates |
| L-06 | API | Throttle global 200/min | **PASS** — `app.module.ts` |
| L-07 | API | Throttle delete account 1/min | **PASS** — `auth.controller.ts` |
| L-08 | API | SuperAdmin guard admin routes | **PASS** — `admin-platform.controller.ts` |
| L-09 | API | IDOR transactions marketplace | **PASS** — `getById` vérifie buyer/seller L115-116 |
| L-10 | API | Commission rate figée à création tx | **PASS** — L72, L95 |
| L-11 | API | PigPrice public index agrégé | **PASS** — `pig-price-index.controller.ts` retourne agrégats |
| L-12 | Deps | npm audit high/critical | **PASS** (aucun critical/high) — moderate uniquement (ajv, qs, ws, postcss) |

---

## Matrice de conformité par domaine d'audit

| Domaine | PASS | FAIL | CANNOT_DETERMINE | Verdict |
|---------|------|------|------------------|---------|
| 1. Auth & session | 4 | 4 | 3 | **High** |
| 2. API security | 6 | 7 | 1 | **High** |
| 3. Payment & escrow | 3 | 12 | 1 | **CRITIQUE** |
| 4. Data exposure | 4 | 5 | 0 | **CRITIQUE** |
| 5. Input validation | 3 | 4 | 1 | **Medium** |
| 6. Mobile app | 2 | 8 | 0 | **High** |
| 7. Rate limiting | 3 | 4 | 2 | **Medium** |
| 8. Infrastructure | 3 | 5 | 2 | **Medium** |
| 9. Business logic | 2 | 4 | 0 | **High** |

---

## Plan de remédiation recommandé

### Phase 0 — Bloquant prod (0-2 semaines)

1. Remplacer `DevMobileMoneyGateway` + webhooks signés (C-01, C-02, C-12)
2. Lier `providerRef` ↔ `transactionId` (C-03)
3. Verrouillages idempotents `settleTransaction` / `confirmPayment` (C-04, C-05, H-02)
4. Appeler gateway `releaseFunds` marketplace (C-06)
5. SecureStore pour tokens (C-07)
6. RLS Storage + bucket vet privé (C-09, C-10)
7. Bloquer update listing en escrow (C-11)

### Phase 1 — High (2-4 semaines)

8. Guard global ban/suspend (H-01)
9. Helmet + CORS WS (H-04, H-05)
10. DTO validation complète (H-09)
11. EAS Secrets / retirer eas.json keys (H-12)
12. PKCE OAuth natif (H-06)

### Phase 2 — Durcissement (1-2 mois)

13. RLS Postgres tables (C-08)
14. Certificate pinning + root detection (M-08, M-09)
15. 2FA step-up paiements (M-06)
16. Pen test externe + bug bounty pilote

---

## Conclusion

Fermier Pro **ne doit pas ouvrir les paiements mobile money en production** dans l'état actuel du code audité. Les fonds escrow, commissions et remboursements sont **simulés et vulnérables aux races, confirmations client frauduleuses et incohérences ledger**. Les données sensibles (tokens, preuves finance, diplômes vet) présentent des risques d'exposition sur mobile et Supabase Storage.

Le socle NestJS (scopes ferme, validation partielle, throttle, PigPrice anti-manipulation) est une base saine pour itérer rapidement sur les correctifs listés en Phase 0.

---

*Rapport généré par analyse statique du dépôt au commit `0daec55` (main). Aucune modification de code effectuée durant cet audit.*
