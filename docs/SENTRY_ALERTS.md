# Alertes Sentry — API Nest + mobile Expo

## Où c’est branché

| Surface | Emplacement | Variable |
|---------|-------------|----------|
| **API** | `apps/api/src/instrument.ts` (importé en premier dans `main.ts`) + `SentryModule` / `SentryGlobalFilter` | `SENTRY_DSN` |
| **Mobile** | `apps/mobile/src/lib/sentry.ts` (`initSentry` dans `index.js`, `Sentry.wrap` dans `App.tsx`) + plugin `@sentry/react-native/expo` | `EXPO_PUBLIC_SENTRY_DSN` |

Ne pas placer de config Sentry / Next.js à la racine du monorepo.

## Setup projets

1. Sur [sentry.io](https://sentry.io) : créer les projets `fermier-api` et `fermier-mobile`, puis coller les DSN dans `SENTRY_DSN` (Railway / `.env`) et `EXPO_PUBLIC_SENTRY_DSN` (EAS secrets / `apps/mobile/.env`).
2. Builds EAS : définir aussi `EXPO_PUBLIC_APP_ENV` (`preview` / `production`) — déjà dans `apps/mobile/eas.json`. Pour l’upload des sourcemaps natives : secrets `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
3. API → **Alerts** → **Create Alert** → **Issues** (ou **Metric Alert** sur nombre d’événements).
4. Condition : **When an event is seen** avec filtre de tag `payment` égal à `true` (événements `captureMessage` financiers).
5. Action : **Send a notification** → email de l’équipe + intégration **Slack** (channel `#ops-paiements`).
6. Fréquence : **Notify immediately** (pas de digest) — un paiement échoué doit être visible tout de suite.
7. Environnement : limiter à `production` (et éventuellement `staging`) via le filtre `environment`.
8. Uptime : brancher un monitor externe sur `GET /api/v1/health` (attendu `status: ok`, HTTP 200 ; 503 si DB down).
9. Vérifier : simuler un `payment.failed` GeniusPay en staging et confirmer l’arrivée Slack/email sous 1 minute.
10. Ne jamais logger de PII (Authorization, corps webhook, numéros) — le `beforeSend` API masque déjà `+225…` → `+225****`.
11. Doc runbook : en cas d’alerte, ouvrir Sentry → tags `transactionId` / `provider` → corréler avec GeniusPay dashboard.
