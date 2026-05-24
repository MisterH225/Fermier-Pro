import type { OfflineIdMappings } from "./types";

/** Remplace `offline:xxx` et les templates `{{0.id}}` dans path/body. */
export function resolveOfflineValue(
  value: unknown,
  results: unknown[],
  idMappings: OfflineIdMappings
): unknown {
  if (typeof value === "string") {
    let s = value;
    if (s.startsWith("offline:")) {
      const mapped = idMappings[s];
      if (mapped) {
        s = mapped;
      }
    }
    return s.replace(/\{\{(\d+)\.([^}]+)\}\}/g, (_m, idxStr, path) => {
      const idx = Number(idxStr);
      const base = results[idx];
      if (base == null) {
        return _m;
      }
      const parts = String(path).split(".");
      let cur: unknown = base;
      for (const p of parts) {
        if (cur == null || typeof cur !== "object") {
          return _m;
        }
        cur = (cur as Record<string, unknown>)[p];
      }
      return cur != null ? String(cur) : _m;
    });
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveOfflineValue(v, results, idMappings));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveOfflineValue(v, results, idMappings);
    }
    return out;
  }
  return value;
}
