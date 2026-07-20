# Security Audit Report — Fermier-Pro NestJS API

**Date:** 2026-07-20
**Scope:** `/workspace/apps/api/src/` — Authentication, authorization, and access-control review

---

## Executive Summary

The Fermier-Pro API does **not** use a global JWT guard. Only `ThrottlerGuard` is registered as `APP_GUARD` in `app.module.ts` (line 157). Every controller must individually apply `SupabaseJwtGuard`. This opt-in pattern is the root cause of several authentication bypass findings.

---

## Finding 1 — `AdminPenAllocationController`: Admin endpoint protected only by a shared secret header, no JWT authentication

**Severity:** HIGH
**File:** `apps/api/src/housing/admin-pen-allocation.controller.ts`, lines 23–47
**Description:** The `POST /api/v1/admin/fix-pen-allocation` endpoint is authenticated solely via a static secret passed in the `x-pen-allocation-fix-secret` header. There is no `@UseGuards(SupabaseJwtGuard)` on the controller, meaning:
- No user identity is established — the action cannot be attributed to any admin user.
- The shared secret (`PEN_ALLOCATION_FIX_SECRET`) is a single static value: if it leaks, anyone can invoke pen-allocation fixes on arbitrary farms.
- There is no rate-limiting (`@SkipThrottle` is not applied, but the default throttler may help; however, the absence of JWT makes brute-forcing the secret the primary risk).

**Attack path:** An attacker who obtains or brute-forces the `PEN_ALLOCATION_FIX_SECRET` value can call `POST /api/v1/admin/fix-pen-allocation` with any `farmId` and trigger pen-allocation mutations for any farm without being authenticated.

---

## Finding 2 — `AdminVetsController`: Internal endpoint protected only by a shared secret header, no JWT authentication

**Severity:** HIGH
**File:** `apps/api/src/vets/admin-vets.controller.ts`, lines 18–65
**Description:** The `POST /api/v1/internal/vet-profiles/:id/verify` and `POST /api/v1/internal/vet-profiles/:id/reject` endpoints are authenticated solely via the `x-vet-verification-secret` header (compared using `timingSafeEqual`, which is good practice). However:
- No `@UseGuards(SupabaseJwtGuard)` — no user identity or audit trail.
- The shared secret (`VET_VERIFICATION_SECRET`) is a static credential: if it leaks, anyone can verify or reject any vet profile.

**Attack path:** An attacker who obtains the `VET_VERIFICATION_SECRET` can verify fraudulent vet profiles or reject legitimate ones, corrupting the vet verification system.

---

## Finding 3 — `FarmMembersController.remove()`: Missing `FarmScopesGuard` on DELETE endpoint

**Severity:** HIGH
**File:** `apps/api/src/farm-members/farm-members.controller.ts`, lines 43–50
**Description:** The `@Delete(":membershipId")` handler lacks `@UseGuards(FarmScopesGuard)` and `@RequireFarmScopes(...)`, unlike the `@Get()` and `@Patch()` handlers on the same controller. The controller-level guard is only `SupabaseJwtGuard`. This means any authenticated user can attempt to remove a farm member from any farm, subject only to service-layer checks in `FarmMembersService.remove()`.

The service layer (`farm-members.service.ts`) does call `this.farmAccess.requireFarmScopes(actor.id, farmId, [FARM_SCOPE.invitationsManage])`, which provides a defense-in-depth check. However, the guard-level enforcement is inconsistent with the rest of the controller's design.

**Attack path:** If the service-layer check is ever refactored, removed, or bypassed due to a bug, any authenticated user could remove members from any farm. The inconsistency also increases the risk of copy-paste errors in future development.

---

## Finding 4 — `FarmsController`: Several farm-scoped endpoints missing `FarmScopesGuard`

**Severity:** MEDIUM
**File:** `apps/api/src/farms/farms.controller.ts`
**Description:** The following endpoints on `FarmsController` lack `@UseGuards(FarmScopesGuard)` and `@RequireFarmScopes()`:

| Route | Method | Line |
|-------|--------|------|
| `:farmId/transfer-ownership` | POST | 62–69 |
| `:farmId/archive` | PATCH | 172–179 |
| `:farmId/restore` | PATCH | 181–187 |
| `:farmId` | DELETE | 189–192 |
| `:id` (get single farm) | GET | 204–207 |

These operations are protected by `SupabaseJwtGuard` at the controller level and likely have service-layer ownership checks (e.g., verifying the user is the farm owner). However, the absence of `FarmScopesGuard` is inconsistent with other farm-scoped endpoints on the same controller (e.g., `audit-logs`, `cheptel-config`, `cheptel`).

**Attack path:** If the service-layer ownership checks in `FarmsService` are weakened or a new sensitive sub-route is added following the existing pattern, the missing guard would leave it unprotected. For `transfer-ownership` and `DELETE`, the risk is highest as these are destructive operations.

---

## Finding 5 — `CguController.getCurrent()`: Unauthenticated endpoint exposes CGU data

**Severity:** LOW (intentional by design)
**File:** `apps/api/src/cgu/cgu.controller.ts`, lines 23–25
**Description:** `GET /api/v1/cgu/current` has no authentication guard. This appears intentional (public CGU/terms endpoint), but it is listed for completeness. No sensitive data is exposed.

---

## Finding 6 — `ReceiptVerifyController`: Unauthenticated public endpoint with receipt number enumeration risk

**Severity:** MEDIUM
**File:** `apps/api/src/marketplace/receipts/receipt-verify.controller.ts`, lines 7–15
**Description:** `GET /api/v1/verify/:receiptNumber` is a public, unauthenticated endpoint for QR-code receipt verification. While it has throttle-limiting (`20 req/min`), the receipt numbers are the only secret protecting the data. If receipt numbers are predictable or sequential, an attacker could enumerate receipts to extract transaction details.

**Attack path:** An attacker sends requests with incrementing or pattern-guessed receipt numbers at up to 20/min to extract marketplace transaction information.

---

## Finding 7 — `PlatformFeatureFlagsController`: Partially unauthenticated — public list of feature flags

**Severity:** LOW (intentional by design)
**File:** `apps/api/src/feature-flags/platform-feature-flags.controller.ts`, lines 24–43
**Description:** `GET /api/v1/platform/feature-flags` and `GET /api/v1/platform/feature-flags/:moduleId` are public endpoints with no authentication. This reveals which platform modules are enabled/disabled, their user-facing messages, and maintenance status. This is almost certainly intentional (the mobile app needs this before login), but it provides reconnaissance information.

---

## Finding 8 — `ConfigClientController`: Unauthenticated endpoint exposes platform fee rates

**Severity:** LOW (intentional by design)
**File:** `apps/api/src/config-client/config-client.controller.ts`, lines 27–45
**Description:** `GET /api/v1/config/client` returns feature flags, platform modules, support contacts, and **platform commission fee rates** (marketplace buyer/seller commission, vet commission). This is public with no authentication. While the mobile app needs this data pre-login, the commission rates could be considered business-sensitive information.

---

## Finding 9 — `CreditOffersController.resolveArbitration()`: Missing admin-level guard for credit arbitration

**Severity:** HIGH
**File:** `apps/api/src/marketplace/credit/credit-offers.controller.ts`, lines 165–177
**Description:** `PATCH /api/v1/marketplace/arbitrations/:id/resolve` is protected only by `SupabaseJwtGuard` and `PlatformModuleEnabledGuard`. There is no `SuperAdminGuard` or `ConsoleAccessGuard`. This endpoint resolves credit payment arbitrations — a highly sensitive action that determines whether money is refunded or released. Any authenticated user can attempt to call this endpoint. The service-layer implementation must be checked for authorization, but the controller lacks guard-level enforcement.

**Attack path:** An authenticated user (buyer or seller in a dispute, or any other user) calls `PATCH /api/v1/marketplace/arbitrations/:id/resolve` to resolve the arbitration in their favor. If the service layer does not independently verify admin status, the arbitration is resolved without proper authorization.

---

## Finding 10 — WebSocket gateways: No banned/suspended account check after initial connection

**Severity:** MEDIUM
**File:** `apps/api/src/chat/chat.gateway.ts`, lines 38–56; `apps/api/src/tasks/tasks.gateway.ts`, lines 41–57
**Description:** Both WebSocket gateways (`/chat` and `/tasks`) authenticate the initial connection via JWT token and call `this.auth.userFromAccessToken(token)`. However, after the connection is established, the `sendMessage` and `joinRoom`/`joinFarm` handlers only check `client.data.userId` (set at connection time). If a user is banned or suspended after connecting, they retain their WebSocket session and can continue sending messages or joining rooms until they disconnect.

The HTTP `SupabaseJwtGuard` re-checks account status on every request, but the WebSocket gateway does not re-verify banned/suspended status on each message.

**Attack path:** A banned user who has an active WebSocket connection continues sending chat messages or receiving task updates until they disconnect.

---

## Finding 11 — `MerchantShopController`: `GET merchant/me` and `PATCH merchant/me/onboarding` lack `MerchantProfileGuard`

**Severity:** MEDIUM
**File:** `apps/api/src/merchant-shop/merchant-shop.controller.ts`, lines 49–60
**Description:** The `GET /api/v1/merchant/me` and `PATCH /api/v1/merchant/me/onboarding` endpoints have only `SupabaseJwtGuard` at the controller level. Unlike most other merchant endpoints in the same controller, they do not have `@UseGuards(MerchantProfileGuard)`. This means any authenticated user (even those without a merchant profile) can call these endpoints. The service layer likely handles the case gracefully, but the inconsistency is a defense-in-depth gap.

---

## Finding 12 — `MerchantShopController`: Buyer-accessible order endpoints lack consistent role verification

**Severity:** MEDIUM
**File:** `apps/api/src/merchant-shop/merchant-shop.controller.ts`, lines 239–312
**Description:** Several order-management endpoints are accessible to any authenticated user (only `SupabaseJwtGuard`):
- `GET merchant/orders/buyer` (line 239)
- `GET merchant/orders/:orderId` (line 244)
- `POST merchant/orders/:orderId/complete` (line 252)
- `POST merchant/orders/:orderId/dispute` (line 297)
- `POST merchant/orders/:orderId/dispute/respond` (line 305)

While the service layer likely checks order ownership, the absence of guard-level enforcement is inconsistent with seller-side endpoints which use `MerchantProfileGuard`. The `POST merchant/orders/:orderId/complete` endpoint is particularly sensitive as it marks orders as completed (likely triggering payment release).

---

## Webhook Security Assessment

### Supabase SMS Webhook (`POST /api/v1/webhooks/supabase/send-sms`)
**Status:** GOOD
- Uses `standardwebhooks` library for HMAC signature verification.
- Secret is loaded from environment variable.
- No JWT required (correct for server-to-server webhook).

### GeniusPay Webhook (`POST /api/v1/webhooks/geniuspay`)
**Status:** GOOD
- HMAC-SHA256 signature verification with timing-safe comparison.
- Replay protection via timestamp freshness check (300-second tolerance).
- Validates webhook secret format (`whsec_` prefix).
- Good error reporting to Sentry.

---

## Profile Guard Assessment

### `ActiveProfileGuard` — GOOD
Validates that `X-Profile-Id` header belongs to the authenticated user (`userId: user.id`). Cannot be spoofed.

### `OptionalActiveProfileGuard` — GOOD
Same validation but allows missing header. Returns `true` if no user or no profile header. Cannot be spoofed.

### `ProducerProfileGuard` — GOOD
Validates profile exists, belongs to user, and has `ProfileType.producer`. Cannot be spoofed.

### `MerchantProfileGuard` — GOOD
Same as `ProducerProfileGuard` but for `ProfileType.merchant`. Cannot be spoofed.

### `FarmScopesGuard` — GOOD
Reads `farmId` from URL params, calls `FarmAccessService.requireFarmScopes()` to verify user membership and permissions. Cannot be bypassed via header manipulation.

---

## Recommendations

1. **Register `SupabaseJwtGuard` as a global guard** with a `@Public()` decorator for endpoints that should be unauthenticated. This eliminates the risk of forgetting to add the guard on new controllers.

2. **Add `SuperAdminGuard` to `CreditOffersController.resolveArbitration()`** (Finding 9). Arbitration resolution is an admin function.

3. **Add JWT authentication to `AdminPenAllocationController`** (Finding 1) and `AdminVetsController` (Finding 2), or implement proper API key management with rotation capabilities.

4. **Add `FarmScopesGuard` and `@RequireFarmScopes(FARM_SCOPE.invitationsManage)` to `FarmMembersController.remove()`** (Finding 3) for consistency.

5. **Review `FarmsController` routes** (Finding 4) for consistent scope enforcement on destructive operations.

6. **Add periodic re-authentication checks in WebSocket gateways** (Finding 10) to disconnect banned/suspended users.

7. **Add `MerchantProfileGuard` to `merchant/me` and `merchant/me/onboarding`** (Finding 11) for consistency.
