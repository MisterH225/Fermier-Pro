/**
 * Lance `nest start --watch` avec heap étendu, en résolvant @nestjs/cli
 * depuis le workspace (hoist racine ou node_modules local).
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const apiRoot = path.join(__dirname, "..");
const nestEntry = require.resolve("@nestjs/cli/bin/nest.js", {
  paths: [apiRoot]
});

const result = spawnSync(
  process.execPath,
  ["--max-old-space-size=8192", nestEntry, "start", "--watch"],
  { stdio: "inherit", cwd: apiRoot }
);

process.exit(result.status === null ? 1 : result.status);
