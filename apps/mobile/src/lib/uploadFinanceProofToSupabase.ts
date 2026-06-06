import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "finance-proofs";

/**
 * Téléverse une photo de preuve vers le bucket `finance-proofs` (privé, accès membres ferme).
 */
export async function uploadFinanceProofToSupabase(
  supabase: SupabaseClient,
  farmId: string,
  transactionRef: string,
  localUri: string,
  mimeType: string
): Promise<string> {
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const safeRef = transactionRef.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 32);
  const path = `farms/${farmId}/${safeRef}-${Date.now()}.${ext}`;
  const response = await fetch(localUri);
  const buf = await response.arrayBuffer();
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: mimeType || "image/jpeg",
    upsert: false
  });
  if (upErr) {
    throw upErr;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
