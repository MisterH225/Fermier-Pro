/** Réponse d'erreur lue par Supabase Auth quand le hook répond HTTP 200/202. */
export type SupabaseHookErrorResponse = {
  error: {
    http_code: number;
    message: string;
  };
};

/**
 * Supabase n'interprète le corps d'erreur que si le status HTTP est 200 ou 202.
 * Un 503 déclenche des retries puis « Service currently unavailable due to hook ».
 */
export function supabaseHookError(
  message: string,
  httpCode = 503
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
