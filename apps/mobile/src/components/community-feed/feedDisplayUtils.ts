import type { ProfileType } from "@fermier/types";
import { uiNamedColors } from "../../theme/uiNamedColors";

const PROFILE_AVATAR_COLORS: Record<ProfileType, string> = {
  producer: uiNamedColors.c1D9E75,
  veterinarian: uiNamedColors.c4A90D9,
  technician: uiNamedColors.c7C3AED,
  buyer: uiNamedColors.cFF8C00,
  merchant: uiNamedColors.cC2410C
};

const LIKER_PLACEHOLDER_COLORS = [
  uiNamedColors.c1D9E75,
  uiNamedColors.c4A90D9,
  uiNamedColors.c7C3AED,
  uiNamedColors.cFF8C00,
  uiNamedColors.c2F9E44
];

export function displayInitials(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    return "?";
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function formatFeedTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

export function avatarColorForProfileType(profileType: ProfileType): string {
  return PROFILE_AVATAR_COLORS[profileType] ?? uiNamedColors.c6B6B6B;
}

export function likerPlaceholderColor(index: number): string {
  return LIKER_PLACEHOLDER_COLORS[index % LIKER_PLACEHOLDER_COLORS.length]!;
}

export function resolveAuthorDisplayName(input: {
  isAnonymous: boolean;
  authorDisplayName: string | null;
  authorRegion: string | null;
  fallback?: string;
}): string {
  if (input.isAnonymous) {
    return input.authorRegion ?? input.fallback ?? "Région";
  }
  return input.authorDisplayName ?? input.fallback ?? "Membre";
}
