# Security Audit Report — Fermier Pro NestJS API

**Audit Date:** 2026-07-20
**Scope:** `/workspace/apps/api/src/`
**Auditor:** Automated Security Agent

---

## Finding 1: Broken `pg_advisory_lock` in Escrow Settlement — Double-Spend on Fund Release

**Severity:** CRITICAL
**File:** `apps/api/src/marketplace/escrow/marketplace-transaction.service.ts`
**Lines:** 2346–2348, 1964–1966

### Description

The `settleTransaction()` and `settleCreditTransaction()` methods use PostgreSQL advisory locks (`pg_advisory_lock`) via `this.prisma.$executeRaw`. However, with Prisma's connection pooling (and especially behind Supabase's PgBouncer transaction pooler), each `$executeRaw` call may use a **different database connection** than subsequent `findUnique()`, `updateMany()`, and `releaseFundsToSeller()` calls. The advisory lock is bound to the PostgreSQL session/connection, so the lock acquired on one connection provides **zero protection** for operations executing on other connections.

### Code Evidence

```typescript
// Line 2346-2348
async settleTransaction(transactionId: string): Promise<void> {
    const lockKey = `settle:${transactionId}`;
    await this.prisma.$executeRaw`SELECT pg_advisory_lock(hashtext(${lockKey}))`;
    try {
      // These operations may run on DIFFERENT connections:
      const tx = await this.prisma.marketplaceTransaction.findUnique({...});
      // ...fund release, status update all happen outside the lock's connection
```

### Attack Path

1. A buyer confirms receipt on a per-kg marketplace transaction.
2. `confirmReceipt()` calls `settleTransaction()` to release funds.
3. Concurrently, the marketplace cron job or a webhook also triggers `settleTransaction()` for the same transaction.
4. Both processes acquire advisory locks on **different connections** — both succeed.
5. The `priorRelease` check (line 2367) and `updateMany` (line 2446) could race, causing duplicate `releaseFundsToSeller()` calls, crediting the seller wallet twice.

### Mitigation

Replace `pg_advisory_lock` with the existing `DistributedLockService` (Redis-based), or wrap the entire settlement in a Prisma `$transaction` with serializable isolation.

---

## Finding 2: TOCTOU Race Condition in Wallet Withdrawal Initiation

**Severity:** HIGH
**File:** `apps/api/src/wallet/withdrawal-orchestrator.service.ts`
**Lines:** 56–101

### Description

The `initiateWithdrawal()` method has a time-of-check-time-of-use (TOCTOU) race between `assertSufficientBalance()` (line 81) and `lockFundsForWithdrawal()` (lines 97/130). The balance check is a simple read, and the lock is a separate transaction with an atomic `updateMany` WHERE `balance >= amount`. While `lockFundsForWithdrawal` itself is atomic (line 465-478, it uses `updateMany` with a balance condition), the prior `assertSufficientBalance()` call is redundant but misleading — the **real vulnerability** is that between the balance check and the lock, a concurrent transfer or top-up could change the balance, but more critically: two concurrent `initiateWithdrawal` calls can both pass `assertSufficientBalance()` and then both attempt `lockFundsForWithdrawal()`. While only one will succeed at the atomic `updateMany` level, the error handling **after** a gateway failure (lines 173-186) releases funds with a unique idempotency key per attempt, meaning a partial race could leave the system in an inconsistent state if two identical withdrawal initiations occur before the idempotency check (line 85-90) catches them.

### Code Evidence

```typescript
// Line 81: Non-atomic balance check
await this.wallet.assertSufficientBalance(user.id, feeBreakdown.totalDebit);

// Line 83-90: Idempotency uses client-provided or random key
const idempotencyKey =
  clientRequestId?.trim() || `withdraw-init:${randomUUID()}`;
const existing = await this.prisma.withdrawalRequest.findUnique({
  where: { idempotencyKey }
});

// Line 97-101: Separate atomic lock
await this.wallet.lockFundsForWithdrawal(
  user.id, feeBreakdown.totalDebit, summary.currency
);
```

### Attack Path

1. Attacker sends two rapid `POST /users/me/wallet/withdraw/initiate` requests (rate limit is 3/min, so this is allowed).
2. Without a `clientRequestId`, each gets a unique `randomUUID()` idempotency key.
3. Both pass `assertSufficientBalance()` before either locks funds.
4. Both call `lockFundsForWithdrawal()` — the atomic `updateMany` ensures only one succeeds, but if the **first** fails at the gateway level and releases, the **second** could then succeed with the remaining balance that should have been considered locked.

### Mitigation

Use a user-scoped distributed lock (`DistributedLockService`) around the entire withdrawal flow to serialize concurrent withdrawal attempts per user.

---

## Finding 3: Inline `@Body()` Types Bypass Global ValidationPipe

**Severity:** HIGH
**Files:** Multiple controllers
**Locations:**
- `apps/api/src/admin-platform/admin-platform.controller.ts` lines 665, 796, 845, 865
- `apps/api/src/marketplace/escrow/marketplace-transaction.controller.ts` lines 168, 196
- `apps/api/src/farm-settings/farm-settings.controller.ts` lines 37, 52, 63
- `apps/api/src/vets/vets.controller.ts` line 117
- `apps/api/src/vet-appointments/vet-appointment.controller.ts` line 137
- `apps/api/src/marketplace/credit/credit-offers.controller.ts` line 121
- `apps/api/src/community-feed/community-feed-admin.controller.ts` line 66
- `apps/api/src/gestation/gestation.controller.ts` line 164

### Description

The global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` only strips/rejects unknown properties when the body parameter is typed as a **class** with `class-validator` decorators. When the body is typed as a plain TypeScript **interface or inline object type** (`@Body() body: { reason?: string }`), the ValidationPipe has no metadata to work with and passes the entire raw body through **unvalidated and unfiltered**.

This means any extra properties sent by a client in the request body are passed to the handler without being stripped.

### Code Evidence

```typescript
// admin-platform.controller.ts line 796 — admin arbitration weight endpoint
@Post("marketplace/transactions/:id/arbitrate")
adminArbitrateWeight(
  @CurrentUser() admin: User,
  @Param("id") id: string,
  @Body() body: { arbitrationWeightKg: number }  // No class-validator, no whitelist filtering
) {
  return this.marketplaceTransactions.arbitrateWeight(
    admin.id, id, body.arbitrationWeightKg
  );
}

// admin-platform.controller.ts line 845 — admin vet refund amount
@Post("vet-appointments/:id/refund")
adminRefundVetAppointment(
  @Param("id") id: string,
  @Body() body: { amount?: number }  // No validation — amount could be NaN, negative, etc.
) {
  return this.vetAppointments.adminManualRefund(id, body.amount);
}

// farm-settings.controller.ts line 63 — passes full unvalidated body to service
@Patch("notifications")
patchNotifications(
  @CurrentUser() user: User,
  @Param("farmId") farmId: string,
  @Body() body: {
    push?: PatchFarmSettingsDto["alerts"];
    extra?: Record<string, unknown>;  // Arbitrary JSON stored directly to DB
  }
) {
  return this.settings.patchNotifications(user, farmId, body);
}
```

### Attack Path

1. An attacker sends a `PATCH /farms/:id/settings/notifications` request with `body.extra` containing arbitrary large JSON blobs — this data is stored directly to the database `farmAppSettings.notificationExtra` column without size or content validation.
2. For the admin refund endpoint, `body.amount` could be a string like `"99999999"` which `Number()` converts, or could be omitted entirely to trigger a full refund with no amount specified (depending on service logic).

### Mitigation

Replace all inline `@Body() body: { ... }` type annotations with proper DTO classes decorated with `class-validator` validators.

---

## Finding 4: Buyer Email Exposed to Sellers via Offers Endpoint

**Severity:** MEDIUM
**File:** `apps/api/src/marketplace/offers.service.ts`
**Lines:** 256–297

### Description

The `listReceived()` method (called by sellers to view offers on their listings) includes the buyer's **email address** in the response via the Prisma `include`:

```typescript
buyer: { select: { id: true, fullName: true, email: true } },
```

This exposes buyer PII (email) to any seller who receives an offer. The `accept()` method (line 389-401) similarly exposes buyer emails when returning the listing with all offers.

### Code Evidence

```typescript
// Line 266-268 in listReceived()
buyer: { select: { id: true, fullName: true, email: true } },

// Line 394-396 in accept()
buyer: { select: { id: true, fullName: true, email: true } }
```

### Attack Path

1. A seller lists an item on the marketplace.
2. Any buyer submits an offer.
3. The seller calls `GET /marketplace/offers/received`.
4. The response includes the buyer's email address, which was never intended to be shared with sellers.

### Mitigation

Remove `email: true` from the `buyer` select clause in `listReceived()` and `accept()`. If needed, use masked/display-only identifiers.

---

## Finding 5: Community Feed Admin Endpoints Expose User Emails to All Console Users

**Severity:** MEDIUM
**File:** `apps/api/src/community-feed/community-feed.service.ts`
**Lines:** 199, 205, 588, 615, 636

### Description

The community feed admin listing methods (`listPostsAdmin`, `listModEvents`, `listSuspendedUsers`, `listAppeals`) include user email addresses in responses. These endpoints are served by `community-feed-admin.controller.ts` which uses the `ConsoleAccessGuard` — this allows both superadmins **and** institution console users to access them. Institution users are external government/regulatory accounts that should not have access to individual user emails.

### Code Evidence

```typescript
// Line 199 — listPostsAdmin
authorUser: { select: { id: true, email: true, fullName: true } },

// Line 588 — listModEvents
user: { select: { id: true, email: true, fullName: true } }

// Line 615 — listSuspendedUsers
select: { id: true, email: true, fullName: true, feedStatus: true, ... }
```

### Attack Path

An institution console user (e.g., a government agricultural inspector) accesses the feed moderation endpoints and harvests email addresses of all community feed users.

### Mitigation

Restrict email exposure based on the console role, or remove email from institution-visible responses.

---

## Finding 6: Missing Rate Limiting on Marketplace Financial Endpoints

**Severity:** MEDIUM
**Files:**
- `apps/api/src/marketplace/escrow/marketplace-transaction.controller.ts`
- `apps/api/src/marketplace/offers.controller.ts`
- `apps/api/src/marketplace/listings.controller.ts`

### Description

Critical marketplace endpoints that trigger financial operations (payment initiation, payment confirmation, offer creation, offer acceptance) rely solely on the global rate limit of **200 requests per 60 seconds**. In contrast, wallet endpoints appropriately use `@Throttle({ default: { limit: 3, ttl: 60_000 } })`. The marketplace endpoints have no per-endpoint throttle override.

### Code Evidence

```typescript
// marketplace-transaction.controller.ts — NO @Throttle decorator
@Post(":id/payment/initiate")
initiatePayment(...) { ... }

@Post(":id/payment/confirm")
confirmPayment(...) { ... }

// offers.controller.ts — NO @Throttle decorator
@Post("listings/:listingId/offers")
create(...) { ... }

@Post("listings/:listingId/offers/:offerId/accept")
accept(...) { ... }
```

Compare with wallet controller (properly throttled):
```typescript
@Post("top-up/initiate")
@Throttle({ default: { limit: 3, ttl: 60_000 } })
initiateTopUp(...) { ... }
```

### Attack Path

1. An attacker can rapidly call `POST /marketplace/transactions/:id/payment/initiate` up to 200 times per minute, triggering 200 GeniusPay payment initiation calls. This can:
   - Exhaust GeniusPay API quotas
   - Create 200 pending checkout sessions for a single transaction
   - Potentially cause webhook confusion with multiple provider references
2. Offer creation spam: 200 offers/minute across different listings

### Mitigation

Add `@Throttle` decorators on all marketplace financial mutation endpoints with limits similar to wallet (3-5 per minute).

---

## Finding 7: `UpdatePlatformSettingsDto` Allows Any Console User to Modify Commission Rates

**Severity:** HIGH
**File:** `apps/api/src/admin-platform/admin-platform.controller.ts`
**Lines:** 586-589
**DTO File:** `apps/api/src/admin-platform/dto/admin-platform.dto.ts`
**Lines:** 35-222

### Description

The `PATCH /admin/settings` endpoint uses `ConsoleAccessGuard` + `AdminConsoleMenuGuard` but does **not** use `SuperAdminGuard`. The `UpdatePlatformSettingsDto` includes highly sensitive fields like `marketplaceCommissionRate`, `sellerMarketplaceCommissionRate`, `vetCommissionRate`, and `withdrawalAutoApproveThreshold`.

Institution console users (external government accounts) can potentially modify these financial settings if they have the correct menu permissions.

### Code Evidence

```typescript
// admin-platform.controller.ts line 586-589
@Patch("settings")
updateSettings(@Body() dto: UpdatePlatformSettingsDto) {
  return this.admin.updateSettings(dto);
}
// Note: NO @UseGuards(SuperAdminGuard) — only ConsoleAccessGuard + AdminConsoleMenuGuard from class

// DTO includes:
marketplaceCommissionRate?: number;      // 0-99% commission
sellerMarketplaceCommissionRate?: number;
vetCommissionRate?: number;
withdrawalAutoApproveThreshold?: number; // Can set to infinity to auto-approve all withdrawals
```

### Attack Path

1. An institution console user (or compromised institution account) sends `PATCH /admin/settings` with `{ "withdrawalAutoApproveThreshold": 999999999 }`.
2. All withdrawals are now auto-approved without admin review.
3. Or set `marketplaceCommissionRate: 0` to eliminate platform fees.

### Mitigation

Add `@UseGuards(SuperAdminGuard)` to the `updateSettings()` endpoint, or split financial settings into a separate superadmin-only endpoint.

---

## Finding 8: `pg_advisory_lock` Usage Is Documented as Broken with Supabase Pooler

**Severity:** HIGH
**File:** `apps/api/src/common/distributed-lock.service.ts`
**Lines:** 31-42 (comment block)
**File:** `apps/api/src/marketplace/escrow/marketplace-transaction.service.ts`
**Lines:** 2348, 1966

### Description

The codebase itself documents that advisory locks are incompatible with the Supabase transaction pooler:

> *"Remplace les advisory locks Postgres, incompatibles avec le pooler transactionnel Supabase (port 6543) : chaque requête Prisma peut changer de connexion serveur"*

Yet `settleTransaction()` and `settleCreditTransaction()` still use `pg_advisory_lock` via `$executeRaw` instead of the `DistributedLockService` that was created specifically to replace them.

### Code Evidence

```typescript
// distributed-lock.service.ts lines 31-42 — explains the problem
/**
 * Verrou distribué Redis (SET NX PX + release Lua).
 *
 * Remplace les advisory locks Postgres, incompatibles avec le pooler
 * transactionnel Supabase (port 6543) : chaque requête Prisma peut changer
 * de connexion serveur, donc lock/unlock n'étaient pas fiables.
 */

// BUT marketplace-transaction.service.ts still uses the broken mechanism:
await this.prisma.$executeRaw`SELECT pg_advisory_lock(hashtext(${lockKey}))`;
```

### Attack Path

Same as Finding 1 — the advisory lock provides no actual mutual exclusion, enabling double fund release.

### Mitigation

Replace `pg_advisory_lock`/`pg_advisory_unlock` in `settleTransaction()` and `settleCreditTransaction()` with `DistributedLockService.withLock()`.

---

## Finding 9: Wallet Transfer `counterpartyUserId` Leaks Internal User IDs

**Severity:** MEDIUM
**File:** `apps/api/src/wallet/user-wallet.service.ts`
**Lines:** 1118-1142

### Description

The `serializeEntry()` method returns `counterpartyUserId` in wallet entry responses. When a user calls `GET /users/me/wallet/entries`, each transfer entry reveals the internal UUID of the counterparty. Combined with the phone lookup endpoint, this enables enumeration of user IDs.

### Code Evidence

```typescript
// Line 1130-1137
private serializeEntry(row: { ... }): WalletEntryDto {
  return {
    id: row.id,
    kind: row.kind,
    amount: Number(row.amount),
    balanceAfter: Number(row.balanceAfter),
    currency: row.currency,
    transactionId: row.transactionId,
    counterpartyUserId: row.counterpartyUserId ?? null, // Internal UUID exposed
    providerRef: row.providerRef ?? null,               // Payment provider reference exposed
    note: row.note,
    createdAt: row.createdAt.toISOString()
  };
}
```

### Attack Path

1. User A transfers money to User B via phone number.
2. User A checks their wallet entries.
3. Response reveals User B's internal UUID.
4. User A can now use this UUID to probe other endpoints.

### Mitigation

Return a masked display name instead of raw `counterpartyUserId`, or omit it from the response.

---

## Finding 10: Admin Vet Refund Endpoint Accepts Unvalidated Amount

**Severity:** MEDIUM
**File:** `apps/api/src/admin-platform/admin-platform.controller.ts`
**Lines:** 842-848

### Description

The `adminRefundVetAppointment` endpoint accepts `body: { amount?: number }` as an inline type without DTO validation. The `amount` field has no minimum, maximum, or type enforcement from `class-validator`. A negative amount, zero, or extremely large number could be passed.

### Code Evidence

```typescript
@Post("vet-appointments/:id/refund")
adminRefundVetAppointment(
  @Param("id") id: string,
  @Body() body: { amount?: number }   // No class-validator — arbitrary value accepted
) {
  return this.vetAppointments.adminManualRefund(id, body.amount);
}
```

### Attack Path

A console user sends `{ "amount": -50000 }` or `{ "amount": 99999999 }` to refund an arbitrary amount for a vet appointment, potentially creating money or stealing funds.

### Mitigation

Create a proper DTO class with `@IsOptional()`, `@IsNumber()`, `@Min(0)`, `@Max(...)` decorators.

---

## Summary Table

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1 | Broken `pg_advisory_lock` in settlement — double fund release | **CRITICAL** | Race Condition |
| 2 | TOCTOU in wallet withdrawal initiation | **HIGH** | Race Condition |
| 3 | Inline `@Body()` types bypass ValidationPipe (13+ endpoints) | **HIGH** | Mass Assignment |
| 4 | Buyer email exposed to sellers in offer responses | **MEDIUM** | Data Exposure |
| 5 | User emails exposed to institution console users in feed admin | **MEDIUM** | Data Exposure |
| 6 | Missing rate limiting on marketplace financial endpoints | **MEDIUM** | Rate Limiting |
| 7 | Platform settings (commissions, thresholds) modifiable by non-superadmin | **HIGH** | Business Logic |
| 8 | Known-broken `pg_advisory_lock` still used in financial settlement | **HIGH** | Race Condition |
| 9 | Wallet entries leak internal `counterpartyUserId` | **MEDIUM** | Data Exposure |
| 10 | Admin vet refund accepts unvalidated amount | **MEDIUM** | Mass Assignment |
