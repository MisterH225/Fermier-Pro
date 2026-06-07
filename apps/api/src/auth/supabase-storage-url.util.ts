/**
 * Extrait bucket + chemin depuis une URL publique Supabase Storage.
 */
export function parseSupabaseStoragePublicUrl(
  url: string
): { bucket: string; path: string } | null {
  const trimmed = url.trim();
  const marker = "/storage/v1/object/public/";
  const idx = trimmed.indexOf(marker);
  if (idx < 0) {
    return null;
  }
  const rest = trimmed.slice(idx + marker.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) {
    return null;
  }
  const bucket = rest.slice(0, slash);
  const path = decodeURIComponent(rest.slice(slash + 1));
  if (!bucket || !path) {
    return null;
  }
  return { bucket, path };
}
