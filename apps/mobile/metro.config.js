const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname; // apps/mobile
const monorepoRoot = path.resolve(projectRoot, "..", ".."); // Fermier Pro (racine)

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Surveiller tout le monorepo pour les imports cross-workspace.
config.watchFolders = [monorepoRoot];

// Ne jamais embarquer le code Nest/API dans le bundle mobile (résolutions parasites).
config.resolver.blockList = [/[/\\]apps[/\\]api[/\\].*/];

// Ordre de résolution des modules : local d'abord, puis racine du monorepo.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules")
];

/**
 * Délégation correcte vers Metro : `context.resolveRequest(context, …)` casse le chaînage
 * interne et peut produire `transformResult.dependencies === undefined` →
 * « TypeError: dependencies is not iterable ».
 */
const metroResolve = require("metro-resolver").default.resolve;

/**
 * Résolveur personnalisé : intercepte `../../App` depuis `expo/AppEntry.js`.
 *
 * Expo SDK ≥ 52 utilise toujours `expo/AppEntry` comme point d'entrée natif.
 * Ce fichier fait `import App from '../../App'`, qui dans un monorepo ne
 * remonte pas jusqu'à la racine par défaut. On redirige ici vers
 * `apps/mobile/App.tsx` directement.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // `expo/AppEntry.js` importe `../../App` : sous Windows le chemin d’origine
  // contient `expo\AppEntry` ; depuis la racine du repo, Metro peut aussi
  // résoudre sans `metro.config.js` du sous-projet si on ne passe pas `apps/mobile`.
  if (moduleName === "../../App") {
    const origin = (context.originModulePath ?? "").replace(/\\/g, "/");
    if (origin.includes("/expo/") && origin.includes("AppEntry")) {
      return {
        filePath: path.resolve(projectRoot, "App.tsx"),
        type: "sourceFile"
      };
    }
  }
  return metroResolve(context, moduleName, platform);
};

module.exports = config;
