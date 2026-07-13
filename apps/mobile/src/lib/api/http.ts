/**
 * Transport HTTP vers `/api/v1` — extrait de `api.ts` (découpage P3).
 */
import { resolveApiBaseUrl } from "../../env";

export function apiBaseUrl(): string {
  return resolveApiBaseUrl();
}

/**
 * Extrait un message lisible d'une réponse API en erreur.
 * NestJS renvoie `{ "message": string | string[], "error": string, "statusCode": number }`.
 * On retourne uniquement la chaîne `message` (jointe si tableau), pour éviter l'affichage
 * du JSON brut dans les `Alert.alert(title, e.message)` côté app.
 */
export function formatApiErrorBody(text: string, status: number, statusText: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const body = JSON.parse(trimmed) as {
        message?: string | string[];
        error?: string;
      };
      const m = body?.message;
      if (Array.isArray(m) && m.length > 0) {
        return m.join(" · ");
      }
      if (typeof m === "string" && m.trim().length > 0) {
        return m;
      }
      if (typeof body?.error === "string" && body.error.trim().length > 0) {
        return body.error;
      }
    } catch {
      // pas du JSON exploitable — retombe sur le texte brut
    }
  }
  return trimmed || `${status} ${statusText}`.trim();
}

export function apiAuthHeaders(
  accessToken: string,
  activeProfileId?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`
  };
  if (activeProfileId) {
    headers["X-Profile-Id"] = activeProfileId;
  }
  return headers;
}

/** GET JSON sous /api/v1/... avec Bearer (+ profil actif optionnel). */
export async function apiGetJson<T>(
  path: string,
  accessToken: string,
  activeProfileId?: string | null
): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBaseUrl()}/api/v1${p}`;
  const res = await fetch(url, {
    headers: apiAuthHeaders(accessToken, activeProfileId)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatApiErrorBody(text, res.status, res.statusText));
  }
  return JSON.parse(text) as T;
}

/** POST JSON /api/v1/... */
export async function apiPostJson<T>(
  path: string,
  body: unknown,
  accessToken: string,
  activeProfileId?: string | null,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBaseUrl()}/api/v1${p}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...apiAuthHeaders(accessToken, activeProfileId),
      "Content-Type": "application/json",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatApiErrorBody(text, res.status, res.statusText));
  }
  return JSON.parse(text) as T;
}

/** PUT JSON /api/v1/... */
export async function apiPutJson<T>(
  path: string,
  body: unknown,
  accessToken: string,
  activeProfileId?: string | null,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBaseUrl()}/api/v1${p}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...apiAuthHeaders(accessToken, activeProfileId),
      "Content-Type": "application/json",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatApiErrorBody(text, res.status, res.statusText));
  }
  return JSON.parse(text) as T;
}

/** PATCH JSON /api/v1/... */
export async function apiPatchJson<T>(
  path: string,
  body: unknown,
  accessToken: string,
  activeProfileId?: string | null,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBaseUrl()}/api/v1${p}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...apiAuthHeaders(accessToken, activeProfileId),
      "Content-Type": "application/json",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatApiErrorBody(text, res.status, res.statusText));
  }
  return JSON.parse(text) as T;
}

/** POST multipart/form-data /api/v1/... */
export async function apiPostFormData<T>(
  path: string,
  formData: FormData,
  accessToken: string,
  activeProfileId?: string | null
): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBaseUrl()}/api/v1${p}`;
  const res = await fetch(url, {
    method: "POST",
    headers: apiAuthHeaders(accessToken, activeProfileId),
    body: formData
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatApiErrorBody(text, res.status, res.statusText));
  }
  return JSON.parse(text) as T;
}

/** DELETE /api/v1/... — corps JSON optionnel (ex. `{ ok: true }`). */
export async function apiDeleteJson<T>(
  path: string,
  accessToken: string,
  activeProfileId?: string | null,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBaseUrl()}/api/v1${p}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      ...apiAuthHeaders(accessToken, activeProfileId),
      ...extraHeaders
    }
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatApiErrorBody(text, res.status, res.statusText));
  }
  if (!text.trim()) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

