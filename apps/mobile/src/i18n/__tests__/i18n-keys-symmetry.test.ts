import { en } from "../en";
import { fr } from "../fr";

type Dict = Record<string, unknown>;

function flattenKeys(obj: Dict, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Dict, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

describe("i18n key symmetry (fr <-> en)", () => {
  const frKeys = new Set(flattenKeys(fr as Dict));
  const enKeys = new Set(flattenKeys(en as Dict));

  it("has no key present in fr but missing in en", () => {
    const missingInEn = [...frKeys].filter((k) => !enKeys.has(k)).sort();
    expect(missingInEn).toEqual([]);
  });

  it("has no key present in en but missing in fr", () => {
    const missingInFr = [...enKeys].filter((k) => !frKeys.has(k)).sort();
    expect(missingInFr).toEqual([]);
  });
});
