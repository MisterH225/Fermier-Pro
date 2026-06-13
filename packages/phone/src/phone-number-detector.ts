export type MaskResult = {
  maskedText: string;
  wasModified: boolean;
  matchCount: number;
};

const MASK = "****";

type Range = { start: number; end: number };

const PHONE_PATTERNS: RegExp[] = [
  /\+[0-9]{1,3}[\s\-.]?[0-9]{2}[\s\-.]?[0-9]{2}[\s\-.]?[0-9]{2}[\s\-.]?[0-9]{2}/g,
  /00[0-9]{1,3}[\s\-.]?[0-9]{8,10}/g,
  /(?<![0-9])0[0-9]{9}(?![0-9])/g,
  /0[0-9]{1,2}[\s][0-9]{2}[\s][0-9]{2}[\s][0-9]{2}[\s][0-9]{2}/g,
  /0[0-9]{1,2}[-.][0-9]{2}[-.][0-9]{2}[-.][0-9]{2}[-.][0-9]{2}/g,
  /0[0-9]{1,2}\/[0-9]{2}\/[0-9]{2}\/[0-9]{2}\/[0-9]{2}/g
];

const EXCLUSION_PATTERNS: RegExp[] = [
  /[0-9]+[\s]*(FCFA|XOF|GHS|NGN|EUR|USD|CFA|F)\b/gi,
  /[0-9]+[\s]*(kg|g|tonnes?|t)\b/gi,
  /[0-9]{1,2}[/\-.][0-9]{1,2}[/\-.][0-9]{2,4}/g,
  /(Eng|Dem|Trui|Ver|Trui)-[0-9]+/gi
];

function overlaps(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end;
}

function countDigits(value: string): number {
  return value.replace(/\D/g, "").length;
}

function collectExcludedRanges(text: string): Range[] {
  const ranges: Range[] = [];
  for (const pattern of EXCLUSION_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return ranges;
}

function isExcluded(range: Range, excluded: Range[]): boolean {
  return excluded.some((ex) => overlaps(range, ex));
}

function collectPhoneMatches(text: string, excluded: Range[]): Range[] {
  const found: Range[] = [];
  for (const pattern of PHONE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const range = { start: match.index, end: match.index + match[0].length };
      if (countDigits(match[0]) < 8) {
        continue;
      }
      if (isExcluded(range, excluded)) {
        continue;
      }
      found.push(range);
    }
  }
  found.sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const range of found) {
    const last = merged[merged.length - 1];
    if (last && overlaps(last, range)) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function containsPhone(text: string): boolean {
  if (!text.trim()) {
    return false;
  }
  const excluded = collectExcludedRanges(text);
  return collectPhoneMatches(text, excluded).length > 0;
}

export function maskPhoneNumbers(text: string): MaskResult {
  if (!text) {
    return { maskedText: text, wasModified: false, matchCount: 0 };
  }
  const excluded = collectExcludedRanges(text);
  const matches = collectPhoneMatches(text, excluded);
  if (matches.length === 0) {
    return { maskedText: text, wasModified: false, matchCount: 0 };
  }
  let out = "";
  let cursor = 0;
  for (const range of matches) {
    out += text.slice(cursor, range.start) + MASK;
    cursor = range.end;
  }
  out += text.slice(cursor);
  return {
    maskedText: out,
    wasModified: true,
    matchCount: matches.length
  };
}
