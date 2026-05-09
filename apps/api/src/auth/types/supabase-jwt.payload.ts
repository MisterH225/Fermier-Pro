export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  phone?: string;
  role?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}
