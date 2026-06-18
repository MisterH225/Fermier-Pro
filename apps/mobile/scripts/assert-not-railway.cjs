/**
 * Metro (expo start) est un serveur de dev local — pas un service Railway.
 * Échoue tôt avec un message explicite au lieu d'un SIGTERM après healthcheck.
 */
const onRailway = Boolean(
  process.env.RAILWAY_ENVIRONMENT_ID ||
    process.env.RAILWAY_SERVICE_ID ||
    process.env.RAILWAY_PROJECT_ID
);

if (onRailway) {
  console.error(`
[fermier/mobile] Déploiement Railway incorrect.

L'app mobile ne doit pas tourner sur Railway : Metro (expo start) sert au
développement local uniquement. La distribution se fait via EAS Build + OTA.

Actions :
  1. Supprimez ce service Railway (ou changez son répertoire racine).
  2. Pour l'API NestJS : service racine du monorepo, commande « npm run start ».
  3. Pour l'app mobile : « bash scripts/ota-production.sh » (Expo EAS Update).

Voir docs/RAILWAY.md
`);
  process.exit(1);
}
