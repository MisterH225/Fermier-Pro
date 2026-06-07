import type { AIInsight, AIInsightPriority, AIModuleKey } from "./aiTypes";
import { AI_MODULE_KEYS } from "./aiTypes";

function normalizePriority(raw: unknown): AIInsightPriority {
  const p = String(raw ?? "info").toLowerCase();
  if (p === "critical" || p === "critique") {
    return "critical";
  }
  if (p === "warning" || p === "avertissement") {
    return "warning";
  }
  return "info";
}

export function parseAIInsights(
  items: unknown[],
  fallbackModule: AIModuleKey
): AIInsight[] {
  const out: AIInsight[] = [];
  for (const row of items) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const r = row as Record<string, unknown>;
    const title = String(r.title ?? "").trim();
    const message = String(r.message ?? "").trim();
    if (!title || !message) {
      continue;
    }
    const typeRaw = String(r.type ?? fallbackModule) as AIModuleKey;
    const type = AI_MODULE_KEYS.includes(typeRaw) ? typeRaw : fallbackModule;
    out.push({
      type,
      priority: normalizePriority(r.priority),
      title,
      message,
      action_label:
        r.action_label != null
          ? String(r.action_label).trim() || null
          : null,
      action_route:
        r.action_route != null ? String(r.action_route).trim() || null : null
    });
  }
  return out;
}
