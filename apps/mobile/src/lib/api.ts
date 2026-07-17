/**
 * Client HTTP vers `/api/v1` (API Nest liée à ton projet **Supabase** : Auth côté app,
 * Postgres côté serveur). Convention : tout nouvel appel ajouté ici doit avoir un cas
 * dans `apps/api/test/mobile-api-contract.e2e-spec.ts` (GET/POST/PATCH selon le cas).
 */
export * from "./api/http";
export * from "./api/auth";
export * from "./api/community-feed";
export * from "./api/merchant";
export * from "./api/producer";
export * from "./api/config";
export * from "./api/chat";
export * from "./api/farm-members";
export * from "./api/invitations";
export * from "./api/feed-stock";
export * from "./api/farms";
export * from "./api/cheptel";
export * from "./api/tasks";
export * from "./api/vet-consultations";
export * from "./api/dashboard";
export * from "./api/farm-health";
export * from "./api/finance";
export * from "./api/housing";
export * from "./api/marketplace";
export * from "./api/marketplaceOrders";
export * from "./api/vet";
export * from "./api/onboarding";
export * from "./api/reports";
export * from "./api/ai";
export * from "./api/gestation";
export * from "./api/buyer";
export * from "./api/wallet";
export * from "./api/technician";
export * from "./api/market";
export * from "./api/farm-settings";
export * from "./api/predictions";
export * from "./api/profitability";
export * from "./api/historical-records";

