/**
 * Si Metro / Expo est invoqué depuis la racine du monorepo, on réutilise la config
 * mobile (résolution `../../App` → `apps/mobile/App.tsx`, watchFolders, etc.).
 */
module.exports = require("./apps/mobile/metro.config.js");
