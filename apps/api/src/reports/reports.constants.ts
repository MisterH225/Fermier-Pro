/** Bucket Supabase Storage privé pour les PDF rapports ferme. */
export const REPORTS_STORAGE_BUCKET =
  process.env.REPORTS_STORAGE_BUCKET?.trim() ?? "reports";
