/** Priorité : photo annonce → photo animal cheptel → défaut (composant). */
export function pickListingImageUrl(item: {
  photoUrls?: unknown;
  fallbackPhotoUrl?: string | null;
  animal?: { photoUrl?: string | null } | null;
}): string | null {
  const photos = Array.isArray(item.photoUrls) ? item.photoUrls : [];
  for (const u of photos) {
    if (typeof u === "string" && u.trim().length > 0) {
      return u.trim();
    }
  }
  if (typeof item.fallbackPhotoUrl === "string" && item.fallbackPhotoUrl.trim()) {
    return item.fallbackPhotoUrl.trim();
  }
  if (typeof item.animal?.photoUrl === "string" && item.animal.photoUrl.trim()) {
    return item.animal.photoUrl.trim();
  }
  return null;
}

export function listingPhotoUrlsArray(photoUrls: unknown): string[] {
  if (!Array.isArray(photoUrls)) {
    return [];
  }
  return photoUrls.filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0
  );
}
