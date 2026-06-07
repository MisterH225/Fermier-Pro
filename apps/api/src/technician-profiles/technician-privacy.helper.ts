export function privacyDisplayName(fullName: string | null | undefined): string {
  const raw = fullName?.trim();
  if (!raw) {
    return "—";
  }
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return parts[0] ?? "—";
  }
  const lastInitial = parts[parts.length - 1]![0]?.toUpperCase() ?? "";
  return lastInitial ? `${parts[0]} ${lastInitial}.` : parts[0]!;
}

export function parseSpecializations(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
}
