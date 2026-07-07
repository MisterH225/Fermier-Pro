/** Réponse d'erreur lue par Supabase Auth quand le hook répond HTTP 200/202. */
export type SupabaseHookErrorResponse = {
  error: {
    http_code: number;
    message: string;
  };
};

/**
 * http_code 500 : Supabase remonte le message à l'app (503 côté client = JSON illisible).
 */
export function supabaseHookError(
  message: string,
  httpCode = 500
): SupabaseHookErrorResponse {
  return {
    error: {
      http_code: httpCode,
      message
    }
  };
}

export function supabaseHookSuccess(): Record<string, never> {
  return {};
}
