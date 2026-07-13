# Alertes Sentry — paiements mobile money

1. Sur [sentry.io](https://sentry.io) : créer les projets `fermier-api` et `fermier-mobile`, puis coller les DSN dans `SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_DSN`.
2. API → **Alerts** → **Create Alert** → **Issues** (ou **Metric Alert** sur nombre d’événements).
3. Condition : **When an event is seen** avec filtre de tag `payment` égal à `true` (événements `captureMessage` financiers).
4. Action : **Send a notification** → email de l’équipe + intégration **Slack** (channel `#ops-paiements`).
5. Fréquence : **Notify immediately** (pas de digest) — un paiement échoué doit être visible tout de suite.
6. Environnement : limiter à `production` (et éventuellement `staging`) via le filtre `environment`.
7. Uptime : brancher un monitor externe sur `GET /api/v1/health` (attendu `status: ok`, HTTP 200 ; 503 si DB down).
8. Vérifier : simuler un `payment.failed` GeniusPay en staging et confirmer l’arrivée Slack/email sous 1 minute.
9. Ne jamais logger de PII (Authorization, corps webhook, numéros) — le `beforeSend` API masque déjà `+225…` → `+225****`.
10. Doc runbook : en cas d’alerte, ouvrir Sentry → tags `transactionId` / `provider` → corréler avec GeniusPay dashboard.
