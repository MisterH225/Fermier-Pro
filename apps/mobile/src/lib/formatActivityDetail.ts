/**
 * Les logs d’activité API exposent `detail` en JSON (objet), jamais forcément en string.
 * React Native refuse les objets comme enfants de `<Text>` — on coerce toujours en string.
 */
export function formatActivityDetail(
  detail: unknown,
  fallback: string
): string {
  if (detail == null) {
    return fallback;
  }
  if (typeof detail === "string") {
    const trimmed = detail.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof detail === "number" || typeof detail === "boolean") {
    return String(detail);
  }
  if (typeof detail === "object") {
    const record = detail as Record<string, unknown>;
    const preferredKeys = [
      "summary",
      "label",
      "title",
      "name",
      "message",
      "description"
    ] as const;
    for (const key of preferredKeys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }
  return fallback;
}
