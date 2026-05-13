/** Indicatifs E.164 — Afrique de l’Ouest uniquement (liste extensible plus tard). */
export type DialCountry = {
  iso2: string;
  dial: string;
  /** Nom affiché (FR) */
  name: string;
  flag: string;
};

/**
 * CEDEAO / UEMOA + pays riverains ouest-africains courants (sans Europe / Amériques).
 * Ordre alphabétique FR appliqué après définition.
 */
export const PHONE_DIAL_COUNTRIES: DialCountry[] = [
  { iso2: "BJ", dial: "+229", name: "Bénin", flag: "🇧🇯" },
  { iso2: "BF", dial: "+226", name: "Burkina Faso", flag: "🇧🇫" },
  { iso2: "CV", dial: "+238", name: "Cap-Vert", flag: "🇨🇻" },
  { iso2: "CI", dial: "+225", name: "Côte d’Ivoire", flag: "🇨🇮" },
  { iso2: "GM", dial: "+220", name: "Gambie", flag: "🇬🇲" },
  { iso2: "GH", dial: "+233", name: "Ghana", flag: "🇬🇭" },
  { iso2: "GN", dial: "+224", name: "Guinée", flag: "🇬🇳" },
  { iso2: "GW", dial: "+245", name: "Guinée-Bissau", flag: "🇬🇼" },
  { iso2: "LR", dial: "+231", name: "Libéria", flag: "🇱🇷" },
  { iso2: "ML", dial: "+223", name: "Mali", flag: "🇲🇱" },
  { iso2: "MR", dial: "+222", name: "Mauritanie", flag: "🇲🇷" },
  { iso2: "NE", dial: "+227", name: "Niger", flag: "🇳🇪" },
  { iso2: "NG", dial: "+234", name: "Nigeria", flag: "🇳🇬" },
  { iso2: "SN", dial: "+221", name: "Sénégal", flag: "🇸🇳" },
  { iso2: "SL", dial: "+232", name: "Sierra Leone", flag: "🇸🇱" },
  { iso2: "TG", dial: "+228", name: "Togo", flag: "🇹🇬" }
].sort((a, b) => a.name.localeCompare(b.name, "fr"));

export function defaultDialCountry(): DialCountry {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "fr-SN";
    const region = locale.split("-")[1]?.toUpperCase();
    if (region) {
      const hit = PHONE_DIAL_COUNTRIES.find((c) => c.iso2 === region);
      if (hit) {
        return hit;
      }
    }
  } catch {
    /* ignore */
  }
  return PHONE_DIAL_COUNTRIES.find((c) => c.iso2 === "SN") ?? PHONE_DIAL_COUNTRIES[0]!;
}

/** Concatène indicatif + numéro national en E.164 (chiffres uniquement après le +). */
export function buildE164Phone(dial: string, nationalRaw: string): string {
  const d = dial.trim().startsWith("+") ? dial.trim() : `+${dial.replace(/\D/g, "")}`;
  let digits = nationalRaw.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }
  return `${d}${digits}`;
}
