/**
 * Garde-fou cohérence visuelle — échoue si screens/ ou components/
 * réintroduisent des hex en dur ou des borderRadius/fontSize hors échelle.
 *
 * Exceptions : liste courte et commentée ci-dessous (dégradés, marques,
 * fichiers thème eux-mêmes).
 */
import fs from "node:fs";
import path from "node:path";

const MOBILE_SRC = path.resolve(__dirname, "../..");
const ALLOWED_RADIUS = new Set([8, 12, 16, 22, 999]);
const ALLOWED_FONT = new Set([11, 13, 15, 17, 22, 28]);

/** Fichiers exclus (thèmes = source de vérité ; scripts ; tests). */
const FILE_ALLOWLIST = [
  /\/theme\//,
  /\/scripts\//,
  /__tests__/,
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  // Dégradés / illustrations SVG inline (pas de StyleSheet UI)
  /\/assets\//
];

/**
 * Occurrences hex explicitement tolérées (marque / alpha 8 digits / shadow).
 * Format: "relative/path.tsx:hex"
 */
const HEX_ALLOWLIST = new Set<string>([
  // aucune pour l’instant — préférer un token nommé dans le thème du rôle
]);

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walk(full, out);
    } else if (/\.(tsx|ts)$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function isFileAllowed(file: string): boolean {
  const rel = file.replace(/\\/g, "/");
  return FILE_ALLOWLIST.some((re) => re.test(rel));
}

describe("design tokens guard", () => {
  const roots = [
    path.join(MOBILE_SRC, "screens"),
    path.join(MOBILE_SRC, "components")
  ];
  const files = roots.flatMap((r) => walk(r)).filter((f) => !isFileAllowed(f));

  it("has files to scan", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("forbids hardcoded hex colors in screens/ and components/", () => {
    const offenders: string[] = [];
    const hexRe = /['"](#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8}))['"]/g;
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = hexRe.exec(src))) {
        const hex = m[1].toUpperCase();
        const rel = path.relative(MOBILE_SRC, file).replace(/\\/g, "/");
        const key = `${rel}:${hex}`;
        if (HEX_ALLOWLIST.has(key)) continue;
        offenders.push(`${rel} → ${hex}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("forbids borderRadius outside the frozen scale", () => {
    const offenders: string[] = [];
    const re = /borderRadius:\s*(\d+(?:\.\d+)?)/g;
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const n = Number(m[1]);
        if (ALLOWED_RADIUS.has(n)) continue;
        // tokens like mobileRadius.sm are fine — only numeric literals
        const rel = path.relative(MOBILE_SRC, file).replace(/\\/g, "/");
        offenders.push(`${rel} → borderRadius: ${n}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("forbids fontSize outside the frozen scale", () => {
    const offenders: string[] = [];
    const re = /fontSize:\s*(\d+(?:\.\d+)?)/g;
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const n = Number(m[1]);
        if (ALLOWED_FONT.has(n)) continue;
        const rel = path.relative(MOBILE_SRC, file).replace(/\\/g, "/");
        offenders.push(`${rel} → fontSize: ${n}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
