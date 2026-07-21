import { en } from "../en";
import { fr } from "../fr";

type Dict = Record<string, unknown>;

function flattenStrings(obj: Dict, prefix = ""): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flattenStrings(v as Dict, path));
    } else if (typeof v === "string") {
      out.push({ key: path, value: v });
    }
  }
  return out;
}

/** Soft UX target is ~110 chars; hard CI fail at 200. */
const MAX_STRING_LENGTH = 200;

/**
 * Glossary blacklist — user-facing copy must use the approved terms.
 * Interpolation placeholders like {{status}} / {{valid}} are ignored via word checks on the raw string
 * only when the banned token appears as a real word (not only inside {{…}}).
 */
const FR_BLACKLIST: Array<{ term: RegExp; label: string }> = [
  { term: /\btransaction(s)?\b/i, label: "transaction" },
  { term: /\blitige(s)?\b/i, label: "litige" },
  { term: /\bportefeuille(s)?\b/i, label: "portefeuille" },
  { term: /\bséquestre(s)?\b/i, label: "séquestre" },
  { term: /\bescrow\b/i, label: "escrow" },
  { term: /\barbitrage(s)?\b/i, label: "arbitrage" },
  { term: /\bcontre-?déclaration(s)?\b/i, label: "contre-déclaration" },
];

const EN_BLACKLIST: Array<{ term: RegExp; label: string }> = [
  { term: /\btransactions?\b/i, label: "transaction" },
  { term: /\bdisputes?\b/i, label: "dispute" },
  { term: /\bwallets?\b/i, label: "wallet" },
  { term: /\bescrow\b/i, label: "escrow" },
  { term: /\barbitration\b/i, label: "arbitration" },
  { term: /\bcounter[- ]?declarations?\b/i, label: "counter-declaration" },
];

const TECH_PATTERNS: Array<{ term: RegExp; label: string }> = [
  { term: /EXPO_PUBLIC_/, label: "EXPO_PUBLIC_" },
  { term: /\bSupabase\b/i, label: "Supabase" },
  { term: /\blocalhost\b/i, label: "localhost" },
  { term: /\bwebhook\b/i, label: "webhook" },
];

function stripInterpolation(value: string): string {
  return value.replace(/\{\{[^}]+\}\}/g, " ");
}

describe("ui language guards (fr / en)", () => {
  const frStrings = flattenStrings(fr as Dict);
  const enStrings = flattenStrings(en as Dict);

  it(`rejects strings longer than ${MAX_STRING_LENGTH} characters`, () => {
    const tooLong = [...frStrings, ...enStrings]
      .filter(({ value }) => value.length > MAX_STRING_LENGTH)
      .map(({ key, value }) => `${key} (${value.length})`);
    expect(tooLong).toEqual([]);
  });

  it("rejects FR glossary blacklist terms", () => {
    const hits: string[] = [];
    for (const { key, value } of frStrings) {
      const text = stripInterpolation(value);
      for (const { term, label } of FR_BLACKLIST) {
        if (term.test(text)) hits.push(`${key}: ${label}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("rejects EN glossary blacklist terms", () => {
    const hits: string[] = [];
    for (const { key, value } of enStrings) {
      const text = stripInterpolation(value);
      for (const { term, label } of EN_BLACKLIST) {
        if (term.test(text)) hits.push(`${key}: ${label}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("rejects technical setup terms in user-facing copy", () => {
    const hits: string[] = [];
    for (const { key, value } of [...frStrings, ...enStrings]) {
      for (const { term, label } of TECH_PATTERNS) {
        if (term.test(value)) hits.push(`${key}: ${label}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
