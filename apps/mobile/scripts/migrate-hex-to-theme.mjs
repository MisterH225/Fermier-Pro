/**
 * Remplace les hex blancs/gris canoniques par mobileColors dans les fichiers
 * qui importent déjà mobileTheme.
 */
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src");

const WHITE_PATTERNS = [
  [/(?<!background)color:\s*["']#fff["']/gi, "color: mobileColors.onAccent"],
  [/(?<!background)color:\s*["']#ffffff["']/gi, "color: mobileColors.onAccent"],
  [/color=["']#fff["']/gi, "color={mobileColors.onAccent}"],
  [/color=["']#ffffff["']/gi, "color={mobileColors.onAccent}"],
  [
    /<ActivityIndicator color=["']#fff["']/gi,
    "<ActivityIndicator color={mobileColors.onAccent}"
  ],
  [
    /<ActivityIndicator color=["']#ffffff["']/gi,
    "<ActivityIndicator color={mobileColors.onAccent}"
  ]
];

const SURFACE_PATTERNS = [
  [/backgroundColor:\s*["']#fff["']/gi, "backgroundColor: mobileColors.background"],
  [/backgroundColor:\s*["']#ffffff["']/gi, "backgroundColor: mobileColors.background"],
  [/backgroundColor:\s*["']#F2F2F7["']/g, "backgroundColor: mobileColors.canvas"],
  [/backgroundColor:\s*["']#E8E8E8["']/g, "backgroundColor: mobileColors.border"],
  [/borderColor:\s*["']#E8E8E8["']/g, "borderColor: mobileColors.border"],
  [/color:\s*["']#111111["']/g, "color: mobileColors.textPrimary"],
  [/color:\s*["']#111["']/g, "color: mobileColors.textPrimary"],
  [/color:\s*["']#6B6B6B["']/g, "color: mobileColors.textSecondary"]
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "theme") continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

let changed = 0;
for (const file of walk(SRC)) {
  let text = fs.readFileSync(file, "utf8");
  if (!/mobileColors/.test(text)) continue;
  const before = text;
  for (const [re, rep] of [...WHITE_PATTERNS, ...SURFACE_PATTERNS]) {
    text = text.replace(re, rep);
  }
  if (text !== before) {
    fs.writeFileSync(file, text);
    changed++;
    console.log(path.relative(SRC, file));
  }
}
console.log(`\n${changed} fichier(s) mis à jour.`);
