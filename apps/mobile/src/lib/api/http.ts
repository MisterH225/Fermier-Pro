/**
 * Transport HTTP vers `/api/v1` — extrait de `api.ts` (découpage P3).
 */
import { resolveApiBaseUrl } from "../../env";

export function apiBaseUrl(): string {
  return resolveApiBaseUrl();
}

export type SubscriptionLimitErrorCode =
  | "FARM_LIMIT_REACHED"
  | "SHOP_LIMIT_REACHED"
  | "PRODUCT_LIMIT_REACHED";

export const SUBSCRIPTION_LIMIT_CODES: ReadonlySet<string> = new Set([
  "FARM_LIMIT_REACHED",
  "SHOP_LIMIT_REACHED",
  "PRODUCT_LIMIT_REACHED"
]);

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export type ParsedApiErrorBody = {
  message: string;
  code: string | null;
};

/**
 * Extrait message + code d'une réponse API en erreur.
 * NestJS renvoie `{ "message": string | string[], "error": string, "statusCode": number, "code"?: string }`.
 */
export function parseApiErrorBody(
  text: string,
  status: number,
  statusText: string
): ParsedApiErrorBody {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const body = JSON.parse(trimmed) as {
        message?: string | string[];
        error?: string;
        code?: string;
      };
      const code =
        typeof body?.code === "string" && body.code.trim().length > 0
          ? body.code.trim()
          : null;
      const m = body?.message;
      if (Array.isArray(m) && m.length > 0) {
        return { message: m.join(" · "), code };
      }
      if (typeof m === "string" && m.trim().length > 0) {
        return { message: m, code };
      }
      if (typeof body?.error === "string" && body.error.trim().length > 0) {
        return { message: body.error, code };
      }
      return {
        message: trimmed || `${status} ${statusText}`.trim(),
        code
      };
    } catch {
      // pas du JSON exploitable — retombe sur le texte brut
    }
  }
  return {
    message: trimmed || `${status} ${statusText}`.trim(),
    code: null
  };
}

/**
 * Extrait un message lisible d'une réponse API en erreur.
 * On retourne uniquement la chaîne `message` (jointe si tableau), pour éviter l'affichage
 * du JSON brut dans les `Alert.alert(title, e.message)` côté app.
 */
export function formatApiErrorBody(
  text: string,
  status: number,
  statusText: string
): string {
  return parseApiErrorBody(text, status, statusText).message;
}

function throwApiError(text: string, status: number, statusText: string): never {
  const parsed = parseApiErrorBody(text, status, statusText);
  throw new ApiError(parsed.message, status, parsed.code);
}

export function getApiErrorCode(err: unknown): string | null {
  if (err instanceof ApiError) {
    return err.code;
  }
  return null;
}

export function isSubscriptionLimitError(
  err: unknown
): err is ApiError & { code: SubscriptionLimitErrorCode } {
  const code = getApiErrorCode(err);
  return code != null && SUBSCRIPTION_LIMIT_CODES.has(code);
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
    throwApiError(text, res.status, res.statusText);
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
    throwApiError(text, res.status, res.statusText);
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
    throwApiError(text, res.status, res.statusText);
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
    throwApiError(text, res.status, res.statusText);
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
    throwApiError(text, res.status, res.statusText);
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
    throwApiError(text, res.status, res.statusText);
  }
  if (!text.trim()) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}
