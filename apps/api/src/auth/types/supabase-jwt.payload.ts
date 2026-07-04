export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  phone?: string;
  role?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  email_confirmed_at?: string;
  phone_confirmed_at?: string;
  confirmed_at?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}
