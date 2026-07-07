/**
 * Normalisation des mobiles ivoiriens (+225).
 * Depuis 2021, le format national est 10 chiffres (0X XX XX XX XX).
 * Yellika et les opérateurs attendent 225 + ces 10 chiffres (ex. 2250708425141).
 */

const CI_COUNTRY_CODE = "225";

/** 9 chiffres sans le 0 initial (ex. 708425141) après le code pays. */
const CI_NATIONAL_WITHOUT_ZERO = /^[0157]\d{8}$/;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Corrige le segment national CI (10 chiffres avec 0 initial). */
export function normalizeCiNationalDigits(national: string): string {
  let n = digitsOnly(national);
  if (n.length === 9 && CI_NATIONAL_WITHOUT_ZERO.test(n)) {
    return `0${n}`;
  }
  return n;
}

/**
 * Normalise un numéro E.164 (corrige +225708… → +2250708…).
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
  if (!allDigits.startsWith(CI_COUNTRY_CODE)) {
    return withPlus;
  }
  const national = allDigits.slice(CI_COUNTRY_CODE.length);
  const fixedNational = normalizeCiNationalDigits(national);
  return `+${CI_COUNTRY_CODE}${fixedNational}`;
}

/**
 * Construit E.164 à partir de l'indicatif (+225) et du numéro national saisi.
 */
export function buildE164FromDialAndNational(
  dial: string,
  nationalRaw: string
): string {
  const cc = digitsOnly(dial);
  let national = digitsOnly(nationalRaw);
  if (cc === CI_COUNTRY_CODE) {
    national = normalizeCiNationalDigits(national);
    return `+${cc}${national}`;
  }
  if (national.startsWith("0")) {
    national = national.replace(/^0+/, "");
  }
  return `+${cc}${national}`;
}

/** Chiffres seuls pour Yellika SMS (ex. 2250708425141). */
export function formatE164ForYellikaSms(e164: string): string {
  return normalizeE164Phone(e164).replace(/\D/g, "");
}
