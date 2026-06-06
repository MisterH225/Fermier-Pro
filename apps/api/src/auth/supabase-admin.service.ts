import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseSupabaseStoragePublicUrl } from "./supabase-storage-url.util";

@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string | null {
    const url = this.config.get<string>("SUPABASE_URL")?.trim();
    return url ? url.replace(/\/$/, "") : null;
  }

  private get serviceRoleKey(): string | null {
    return this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? null;
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.serviceRoleKey);
  }

  /** Supprime l'utilisateur Auth Supabase (déconnexion de tous les appareils). */
  async deleteAuthUser(supabaseUserId: string): Promise<void> {
    const base = this.baseUrl;
    const key = this.serviceRoleKey;
    if (!base || !key) {
      this.logger.warn(
        "Supabase admin non configuré — utilisateur Auth non supprimé côté Supabase"
      );
      return;
    }
    const res = await fetch(`${base}/auth/v1/admin/users/${supabaseUserId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key
      }
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      throw new Error(
        `Supabase delete user failed (${res.status}): ${text.slice(0, 200)}`
      );
    }
  }

  /**
   * Supprime des objets Storage (chemins relatifs au bucket, ex. `uid/avatar.jpg`).
   */
  async removeStorageObjects(
    bucket: string,
    paths: string[]
  ): Promise<void> {
    const base = this.baseUrl;
    const key = this.serviceRoleKey;
    if (!base || !key || paths.length === 0) {
      return;
    }
    const unique = [...new Set(paths.filter(Boolean))];
    const res = await fetch(`${base}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(unique)
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      this.logger.warn(
        `Storage delete ${bucket} (${res.status}): ${text.slice(0, 200)}`
      );
    }
  }

  /**
   * URL signée pour un objet Storage (bucket privé ou accès admin).
   * Accepte une URL publique Supabase stockée en base.
   */
  async createSignedStorageUrl(
    storedUrl: string,
    expiresInSeconds = 3600
  ): Promise<string | null> {
    const parsed = parseSupabaseStoragePublicUrl(storedUrl);
    const base = this.baseUrl;
    const key = this.serviceRoleKey;
    if (!parsed || !base || !key) {
      return null;
    }
    const pathEnc = parsed.path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const res = await fetch(
      `${base}/storage/v1/object/sign/${parsed.bucket}/${pathEnc}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ expiresIn: expiresInSeconds })
      }
    );
    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(
        `Storage sign ${parsed.bucket} (${res.status}): ${text.slice(0, 200)}`
      );
      return null;
    }
    const body = (await res.json()) as { signedURL?: string; signedUrl?: string };
    const relative = body.signedURL ?? body.signedUrl;
    if (!relative) {
      return null;
    }
    return relative.startsWith("http") ? relative : `${base}${relative}`;
  }
}
