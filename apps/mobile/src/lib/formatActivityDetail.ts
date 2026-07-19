/**
 * Libellés d’actions `MemberActivityLog.action` (codes API → texte UI).
 */
const ACTION_LABELS: Record<string, string> = {
  finance_entry: "Saisie finance",
  feed_movement: "Mouvement de stock",
  health_event: "Événement santé",
  gestation_created: "Gestation enregistrée",
  task_created: "Tâche créée",
  livestock_created: "Cheptel ajouté",
  livestock_updated: "Cheptel mis à jour",
  permissions_updated: "Permissions modifiées",
  member_joined: "A rejoint la ferme",
  member_removed: "Accès révoqué",
  invitation_sent: "Invitation envoyée"
};

/**
 * Libellés du champ `detail.kind` (finance, stock, santé…).
 */
const KIND_LABELS: Record<string, string> = {
  expense: "Dépense",
  revenue: "Recette",
  in: "Entrée stock",
  out: "Sortie stock",
  stock_check: "Contrôle de stock",
  vaccination: "Vaccination",
  disease: "Maladie",
  treatment: "Traitement",
  mortality: "Mortalité",
  vet_visit: "Visite vétérinaire",
  weighing: "Pesée"
};

const PREFERRED_KEYS = [
  "summary",
  "label",
  "title",
  "name",
  "message",
  "description"
] as const;

function tryParseJsonObject(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function labelFromRecord(
  record: Record<string, unknown>,
  fallback: string
): string {
  for (const key of PREFERRED_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  const kind = record.kind;
  if (typeof kind === "string" && kind.trim()) {
    return KIND_LABELS[kind] ?? humanizeCode(kind);
  }
  return fallback;
}

function humanizeCode(code: string): string {
  return code
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Titre lisible pour une ligne d’activité (remplace `finance_entry`, etc.).
 */
export function formatActivityAction(action: string): string {
  if (!action?.trim()) {
    return "Activité";
  }
  return ACTION_LABELS[action] ?? humanizeCode(action);
}

/**
 * Les logs d’activité API exposent `detail` en JSON (objet ou string JSON).
 * On renvoie toujours un libellé humain — jamais de JSON brut dans l’UI.
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
    if (!trimmed) {
      return fallback;
    }
    const asObject = tryParseJsonObject(trimmed);
    if (asObject) {
      return labelFromRecord(asObject, fallback);
    }
    return trimmed;
  }
  if (typeof detail === "number" || typeof detail === "boolean") {
    return String(detail);
  }
  if (typeof detail === "object" && !Array.isArray(detail)) {
    return labelFromRecord(detail as Record<string, unknown>, fallback);
  }
  return fallback;
}
