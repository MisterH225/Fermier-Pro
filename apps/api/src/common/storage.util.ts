import { REPORTS_STORAGE_BUCKET } from "../reports/reports.constants";

/** Extrait le chemin objet Supabase depuis une URL publique de bucket. */
export function storagePathFromPublicUrl(
  url: string | null | undefined,
  bucket: string
): string | null {
  if (!url?.trim()) {
    return null;
  }
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) {
    return null;
  }
  return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
}

/** Chemin PDF rapport : bucket dédié ou repli finance-proofs. */
export function reportPdfStoragePath(
  pdfUrl: string | null | undefined,
  reportsBucket = REPORTS_STORAGE_BUCKET
): string | null {
  if (!pdfUrl?.trim()) {
    return null;
  }
  const trimmed = pdfUrl.trim();
  const fromReports = storagePathFromPublicUrl(trimmed, reportsBucket);
  if (fromReports) {
    return fromReports;
  }
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return trimmed.replace(/^\/+/, "");
  }
  return storagePathFromPublicUrl(trimmed, "finance-proofs");
}
