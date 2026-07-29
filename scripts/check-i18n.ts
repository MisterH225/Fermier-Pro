/**
 * Vérifie que toutes les clés i18n utilisées dans apps/mobile/src
 * existent dans fr.ts ET en.ts.
 *
 * Usage : npx tsx scripts/check-i18n.ts
 * Exit 1 si des clés manquent.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const SRC = path.join(ROOT, "apps/mobile/src");
const FR_FILE = path.join(SRC, "i18n/fr.ts");
const EN_FILE = path.join(SRC, "i18n/en.ts");

/** Valeurs d’enum / unions pour étendre les t(`prefix.${x}`). */
const DYNAMIC_ENUMS: Record<string, readonly string[]> = {
  "merchant.orders.status": [
    "payment_pending",
    "paid",
    "paidBuyer",
    "confirmed",
    "shipping",
    "delivered",
    "completed",
    "rejected",
    "auto_rejected",
    "refunded",
    "disputed",
    "cancelled",
    "failed"
  ],
  "merchant.orders.activity": [
    "payment_pending",
    "paid",
    "confirmed",
    "shipping",
    "delivered",
    "completed",
    "rejected",
    "auto_rejected",
    "refunded",
    "disputed",
    "cancelled",
    "failed",
    "title",
    "empty",
    "generic"
  ],
  "merchant.orders.filter": [
    "all",
    "payment_pending",
    "paid",
    "confirmed",
    "shipping",
    "delivered",
    "disputed",
    "completed"
  ],
  "merchant.orders.progress": ["received", "in_transit", "delivered"],
  "merchant.orders.paymentMethods": ["wallet", "mobile_money", "unknown"],
  "ordersTracking.steps": ["received", "in_transit", "delivered"],
  "ordersTracking.badge": ["pickedUp", "inTransit", "delivered", "disputed"],
  "orders.hub.segments": ["action_required", "active", "disputed", "closed"],
  "orders.hub.empty": ["action_required", "active", "disputed", "closed"],
  "orders.hub.escrowStatus": [
    "OFFER_ACCEPTED",
    "PAYMENT_PENDING",
    "PAYMENT_HELD",
    "PICKUP_PROPOSED",
    "PICKUP_SCHEDULED",
    "SELLER_SHIPPED",
    "BUYER_RECEIVED",
    "DELIVERY_DISPUTED",
    "WEIGHT_DECLARED",
    "WEIGHT_COUNTER_DECLARED",
    "WEIGHT_DISPUTED",
    "WEIGHT_VALIDATED",
    "TRANSACTION_CLOSED",
    "CANCELLED_BY_BUYER",
    "CANCELLED_BY_SELLER",
    "CANCELLED_SOLD_TO_OTHER",
    "PAYMENT_FAILED",
    "OFFER_EXPIRED",
    "unknown"
  ],
  "marketScreen.transaction.status": [
    "OFFER_ACCEPTED",
    "PAYMENT_PENDING",
    "PAYMENT_HELD",
    "PICKUP_PROPOSED",
    "PICKUP_SCHEDULED",
    "SELLER_SHIPPED",
    "BUYER_RECEIVED",
    "DELIVERY_DISPUTED",
    "WEIGHT_DECLARED",
    "WEIGHT_COUNTER_DECLARED",
    "WEIGHT_DISPUTED",
    "WEIGHT_VALIDATED",
    "TRANSACTION_CLOSED",
    "CANCELLED_BY_BUYER",
    "CANCELLED_BY_SELLER",
    "CANCELLED_SOLD_TO_OTHER",
    "PAYMENT_FAILED",
    "OFFER_EXPIRED"
  ],
  "marketScreen.transaction.shortStatus": [
    "OFFER_ACCEPTED",
    "PAYMENT_PENDING",
    "PAYMENT_HELD",
    "PICKUP_PROPOSED",
    "PICKUP_SCHEDULED",
    "SELLER_SHIPPED",
    "BUYER_RECEIVED",
    "DELIVERY_DISPUTED",
    "WEIGHT_DECLARED",
    "WEIGHT_COUNTER_DECLARED",
    "WEIGHT_DISPUTED",
    "WEIGHT_VALIDATED",
    "TRANSACTION_CLOSED",
    "CANCELLED_BY_BUYER",
    "CANCELLED_BY_SELLER",
    "CANCELLED_SOLD_TO_OTHER",
    "PAYMENT_FAILED",
    "OFFER_EXPIRED",
    "unknown"
  ],
  "marketScreen.transaction.paymentState": [
    "held",
    "released",
    "cancelled",
    "failed",
    "credit",
    "pending"
  ],
  "cheptel.animals.sex": ["male", "female", "unknown"],
  "deadline.outcome": [
    "merchant_auto_accept",
    "merchant_auto_complete",
    "escrow_auto_release",
    "escrow_auto_cancel",
    "offer_expired"
  ]
};

type Dict = Record<string, unknown>;

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "i18n" ||
        entry.name === "__tests__"
      ) {
        continue;
      }
      walkFiles(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.d\.ts$/.test(entry.name)) continue;
    // Les fixtures de tests créent souvent des clés fictives — on les ignore.
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

function flatten(obj: Dict, prefix = "", out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v as Dict, p, out);
    } else if (typeof v === "string") {
      out[p] = v;
    }
  }
  return out;
}

async function loadLocale(
  file: string,
  exportName: "fr" | "en"
): Promise<Record<string, string>> {
  let src = fs.readFileSync(file, "utf8");
  src = src.replace(`export const ${exportName}`, `const ${exportName}`);
  src = src.replace(/ as const;?\s*$/m, ";");
  src += `\nexport default ${exportName};\n`;
  const tmp = path.join(
    os.tmpdir(),
    `check-i18n-${exportName}-${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`
  );
  fs.writeFileSync(tmp, src);
  try {
    const mod = await import(pathToFileURL(tmp).href);
    return flatten(mod.default as Dict);
  } finally {
    fs.unlinkSync(tmp);
  }
}

type KeyHit = { key: string; file: string; line: number; kind: string };

function relativize(file: string): string {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

function collectStaticKeys(source: string, file: string, hits: KeyHit[]) {
  const patterns: Array<{ re: RegExp; kind: string; group: number }> = [
    // t("a.b") / t('a.b') / i18n.t("a.b")
    {
      re: /\b(?:i18n\.)?t\(\s*(['"])([a-zA-Z][\w.]*)\1/g,
      kind: "t()",
      group: 2
    },
    // labelKey: "a.b" / titleKey: "a.b" / emptyLabelKey / outcomeKey / subtitleKey
    {
      re: /\b(?:labelKey|titleKey|emptyLabelKey|outcomeKey|subtitleKey|statusLabelKey|deadlineLabelKey)\s*[:=]\s*(['"])([a-zA-Z][\w.]*)\1/g,
      kind: "propKey",
      group: 2
    }
  ];

  for (const { re, kind, group } of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) {
      const key = m[group];
      if (!key || !key.includes(".")) continue;
      const line = source.slice(0, m.index).split("\n").length;
      hits.push({ key, file: relativize(file), line, kind });
    }
  }
}

function childrenOfPrefix(
  flat: Record<string, string>,
  prefix: string
): string[] {
  const needle = `${prefix}.`;
  const kids = new Set<string>();
  for (const key of Object.keys(flat)) {
    if (!key.startsWith(needle)) continue;
    const rest = key.slice(needle.length);
    const leaf = rest.split(".")[0];
    if (leaf) kids.add(leaf);
  }
  return [...kids].sort();
}

function collectDynamicKeys(
  source: string,
  file: string,
  hits: KeyHit[],
  frFlat: Record<string, string>
) {
  const patterns = [
    /\b(?:i18n\.)?t\(\s*`([a-zA-Z][\w.]*)\.\$\{[^}]+\}`/g,
    /\b(?:labelKey|titleKey|emptyLabelKey|outcomeKey|statusLabelKey)\s*[:=]\s*`([a-zA-Z][\w.]*)\.\$\{[^}]+\}`/g
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) {
      const prefix = m[1];
      const line = source.slice(0, m.index).split("\n").length;
      const forced = DYNAMIC_ENUMS[prefix];
      const fromDict = childrenOfPrefix(frFlat, prefix);
      const values = forced ?? fromDict;
      if (!values.length) {
        hits.push({
          key: `${prefix}.*`,
          file: relativize(file),
          line,
          kind: "dynamic-unresolved"
        });
        continue;
      }
      for (const value of values) {
        hits.push({
          key: `${prefix}.${value}`,
          file: relativize(file),
          line,
          kind: forced ? "dynamic-expanded" : "dynamic-from-dict"
        });
      }
      // Si DYNAMIC_ENUMS force des valeurs absentes du dict, elles seront
      // signalées comme manquantes — c’est voulu (couverture enum).
    }
  }
}

function mainReport(
  missingFr: string[],
  missingEn: string[],
  unresolved: KeyHit[],
  used: Map<string, KeyHit[]>
) {
  const lines: string[] = [];
  lines.push("# Rapport check-i18n");
  lines.push("");
  lines.push(`Clés utilisées (uniques) : ${used.size}`);
  lines.push(`Manquantes FR : ${missingFr.length}`);
  lines.push(`Manquantes EN : ${missingEn.length}`);
  lines.push(`Dynamiques non résolues : ${unresolved.length}`);
  lines.push("");

  if (missingFr.length) {
    lines.push("## Manquantes dans fr.ts");
    for (const k of missingFr) {
      const refs = (used.get(k) ?? [])
        .slice(0, 3)
        .map((h) => `${h.file}:${h.line}`)
        .join(", ");
      lines.push(`- \`${k}\`${refs ? ` — ${refs}` : ""}`);
    }
    lines.push("");
  }
  if (missingEn.length) {
    lines.push("## Manquantes dans en.ts");
    for (const k of missingEn) {
      const refs = (used.get(k) ?? [])
        .slice(0, 3)
        .map((h) => `${h.file}:${h.line}`)
        .join(", ");
      lines.push(`- \`${k}\`${refs ? ` — ${refs}` : ""}`);
    }
    lines.push("");
  }
  if (unresolved.length) {
    lines.push("## Préfixes dynamiques non couverts (à ajouter dans DYNAMIC_ENUMS)");
    const seen = new Set<string>();
    for (const h of unresolved) {
      if (seen.has(h.key)) continue;
      seen.add(h.key);
      lines.push(`- \`${h.key}\` — ${h.file}:${h.line}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function run() {
  const [frFlat, enFlat] = await Promise.all([
    loadLocale(FR_FILE, "fr"),
    loadLocale(EN_FILE, "en")
  ]);

  const files = walkFiles(SRC);
  const hits: KeyHit[] = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    collectStaticKeys(source, file, hits);
    collectDynamicKeys(source, file, hits, frFlat);
  }

  const used = new Map<string, KeyHit[]>();
  const unresolved: KeyHit[] = [];
  for (const hit of hits) {
    if (hit.kind === "dynamic-unresolved") {
      unresolved.push(hit);
      continue;
    }
    const list = used.get(hit.key) ?? [];
    list.push(hit);
    used.set(hit.key, list);
  }

  const missingFr = [...used.keys()]
    .filter((k) => !(k in frFlat))
    .sort();
  const missingEn = [...used.keys()]
    .filter((k) => !(k in enFlat))
    .sort();

  const report = mainReport(missingFr, missingEn, unresolved, used);
  process.stdout.write(`${report}\n`);

  const fail =
    missingFr.length > 0 || missingEn.length > 0 || unresolved.length > 0;
  if (fail) {
    process.stderr.write(
      `check-i18n: ÉCHEC — ${missingFr.length} FR, ${missingEn.length} EN, ${unresolved.length} dynamiques non résolues.\n`
    );
    process.exit(1);
  }
  process.stdout.write("check-i18n: OK — aucune clé manquante.\n");
}

void run().catch((err) => {
  console.error(err);
  process.exit(1);
});
