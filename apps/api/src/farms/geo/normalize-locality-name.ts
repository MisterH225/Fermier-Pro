/**
 * Normalise un libellé de localité pour matching gazetteer :
 * minuscules, sans accents, espaces compressés.
 */
export function normalizeLocalityName(raw: string | null | undefined): string {
  if (raw == null) return "";
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’`]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
