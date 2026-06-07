import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "listings";
const MAX_BYTES = 5 * 1024 * 1024;

/** Téléverse une image de chat vers le bucket public `listings`. */
export async function uploadChatImageToSupabase(
  supabase: SupabaseClient,
  userId: string,
  roomId: string,
  localUri: string,
  mimeType: string
): Promise<string> {
  const ext = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : "jpg";
  const path = `chat/${userId}/${roomId}/${Date.now()}.${ext}`;
  const response = await fetch(localUri);
  const buf = await response.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    throw new Error("Image trop volumineuse (max 5 Mo)");
  }
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
