import fs from "fs";
import path from "path";
import os from "os";
import { pathToFileURL } from "url";

function loadLocale(file, exportName) {
  let src = fs.readFileSync(file, "utf8");
  src = src.replace(`export const ${exportName}`, `const ${exportName}`);
  src = src.replace(/ as const;?\s*$/m, ";");
  src += `\nexport default ${exportName};\n`;
  const tmp = path.join(os.tmpdir(), `locale-${exportName}-${Date.now()}.mjs`);
  fs.writeFileSync(tmp, src);
  return tmp;
}

const frTmp = loadLocale("apps/mobile/src/i18n/fr.ts", "fr");
const enTmp = loadLocale("apps/mobile/src/i18n/en.ts", "en");

const fr = (await import(pathToFileURL(frTmp).href)).default;
const en = (await import(pathToFileURL(enTmp).href)).default;

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, p, out);
    else out[p] = v;
  }
  return out;
}

const frFlat = flatten(fr);
const enFlat = flatten(en);
const frKeys = Object.keys(frFlat);
const enKeys = Object.keys(enFlat);

const missingInEn = frKeys.filter((k) => !(k in enFlat)).sort();
const missingInFr = enKeys.filter((k) => !(k in frFlat)).sort();

console.log("=== missing in en (present in fr) ===");
for (const k of missingInEn) console.log(`${k}\t=> ${JSON.stringify(frFlat[k])}`);
console.log("\n=== missing in fr (present in en) ===");
for (const k of missingInFr) console.log(`${k}\t=> ${JSON.stringify(enFlat[k])}`);

fs.unlinkSync(frTmp);
fs.unlinkSync(enTmp);
