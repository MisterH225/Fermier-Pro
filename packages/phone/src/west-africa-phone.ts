/**
 * Normalisation E.164 pour les indicatifs Afrique de l’Ouest (alignés sur
 * `PHONE_DIAL_COUNTRIES` côté mobile).
 *
 * Deux familles :
 * - **keepTrunkZero** (CI +225) : le 0 national fait partie de l’E.164 (+2250708425141).
 * - **stripTrunkZero** (reste) : le 0 de décroche local est retiré (+221771234567).
 */

export type WestAfricaPhoneRule = {
  /** Longueur attendue du segment national en E.164. */
  nationalLength: number;
  /** Conserver le 0 initial à la composition internationale. */
  keepTrunkZero: boolean;
  /** Réparation : segment sans 0 mais longueur nationalLength - 1. */
  repairWithoutZeroPattern?: RegExp;
};

/** Indicatifs CEDEAO / voisins — clés = chiffres sans « + ». */
export const WEST_AFRICA_PHONE_RULES: Readonly<
  Record<string, WestAfricaPhoneRule>
> = {
  "220": { nationalLength: 7, keepTrunkZero: false }, // Gambie
  "221": { nationalLength: 9, keepTrunkZero: false }, // Sénégal
  "222": { nationalLength: 8, keepTrunkZero: false }, // Mauritanie
  "223": { nationalLength: 8, keepTrunkZero: false }, // Mali
  "224": { nationalLength: 9, keepTrunkZero: false }, // Guinée
  "225": {
    nationalLength: 10,
    keepTrunkZero: true,
    repairWithoutZeroPattern: /^[0157]\d{8}$/
  }, // Côte d’Ivoire
  "226": { nationalLength: 8, keepTrunkZero: false }, // Burkina Faso
  "227": { nationalLength: 8, keepTrunkZero: false }, // Niger
  "228": { nationalLength: 8, keepTrunkZero: false }, // Togo
  "229": { nationalLength: 8, keepTrunkZero: false }, // Bénin
  "231": { nationalLength: 8, keepTrunkZero: false }, // Libéria
  "232": { nationalLength: 8, keepTrunkZero: false }, // Sierra Leone
  "233": { nationalLength: 9, keepTrunkZero: false }, // Ghana
  "234": { nationalLength: 10, keepTrunkZero: false }, // Nigeria
  "238": { nationalLength: 7, keepTrunkZero: false }, // Cap-Vert
  "245": { nationalLength: 7, keepTrunkZero: false } // Guinée-Bissau
};

const SORTED_COUNTRY_CODES = Object.keys(WEST_AFRICA_PHONE_RULES).sort(
  (a, b) => b.length - a.length
);

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function detectWestAfricaCountryCode(allDigits: string): string | null {
  for (const cc of SORTED_COUNTRY_CODES) {
    if (allDigits.startsWith(cc)) {
      return cc;
    }
  }
  return null;
}

/**
 * Normalise le segment national pour un indicatif connu.
 */
export function normalizeNationalForCountryCode(
  countryCode: string,
  nationalRaw: string
): string {
  const cc = digitsOnly(countryCode);
  const rule = WEST_AFRICA_PHONE_RULES[cc];
  let national = digitsOnly(nationalRaw);

  if (!rule) {
    if (national.startsWith("0")) {
      national = national.replace(/^0+/, "");
    }
    return national;
  }

  if (rule.keepTrunkZero) {
    if (
      national.length === rule.nationalLength - 1 &&
      rule.repairWithoutZeroPattern?.test(national)
    ) {
      national = `0${national}`;
    }
    return national;
  }

  if (national.startsWith("0")) {
    national = national.replace(/^0+/, "");
  }
  return national;
}

/** @deprecated Alias CI — préférer `normalizeNationalForCountryCode("225", …)`. */
export function normalizeCiNationalDigits(national: string): string {
  return normalizeNationalForCountryCode("225", national);
}

/**
 * Normalise un numéro E.164 (corrige 0 manquant ou en trop selon le pays).
 */
export function normalizeE164Phone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) {
    return trimmed;
  }
  const withPlus = trimmed.startsWith("+")
    ? trimmed
    : `+${digitsOnly(trimmed)}`;
  const allDigits = withPlus.slice(1);
  const cc = detectWestAfricaCountryCode(allDigits);
  if (!cc) {
    return withPlus;
  }
  const national = allDigits.slice(cc.length);
  const fixedNational = normalizeNationalForCountryCode(cc, national);
  return `+${cc}${fixedNational}`;
}

/**
 * Construit E.164 à partir de l'indicatif (+225) et du numéro national saisi.
 */
export function buildE164FromDialAndNational(
  dial: string,
  nationalRaw: string
): string {
  const cc = digitsOnly(dial);
  const national = normalizeNationalForCountryCode(cc, nationalRaw);
  return `+${cc}${national}`;
}

/** Chiffres seuls pour envoi SMS (ex. 2250708425141). */
export function formatE164ForYellikaSms(e164: string): string {
  return normalizeE164Phone(e164).replace(/\D/g, "");
}
