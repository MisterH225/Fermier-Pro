import type { TechnicianProfileDto, VetSearchItemDto } from "./api";
import { formatFarmMoney } from "./formatMoney";

export type DirectoryProfileMetaTile = {
  label: string;
  value: string;
};

const SPEC_I18N_KEYS = new Set([
  "feed",
  "health",
  "repro",
  "herd",
  "all"
]);

export function formatDirectoryDistanceKm(
  distanceKm: number | null | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string
): string | null {
  if (distanceKm == null || !Number.isFinite(distanceKm)) {
    return null;
  }
  const rounded =
    distanceKm < 100
      ? Math.round(distanceKm * 10) / 10
      : Math.round(distanceKm);
  return t("collab.directory.distanceKm", { km: rounded });
}

export function formatDirectoryRating(
  ratingAvg: number | null | undefined,
  ratingCount: number | null | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string
): string | null {
  if (ratingAvg == null || !Number.isFinite(ratingAvg)) {
    return t("collab.directory.noRatings");
  }
  const avg = ratingAvg.toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  });
  const count = ratingCount ?? 0;
  return t("collab.directory.ratingSummary", { avg, count });
}

export function techSpecializationLabel(
  key: string,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (SPEC_I18N_KEYS.has(key)) {
    return t(`techOnboarding.spec.${key}`, { defaultValue: key });
  }
  return key;
}

export function buildTechnicianCardModel(
  tech: TechnicianProfileDto,
  t: (key: string, opts?: Record<string, unknown>) => string
) {
  const name = tech.displayName?.trim() || t("collab.directory.techFallbackName");
  const specs = [
    ...new Set(tech.specializations.map((s) => techSpecializationLabel(s, t)))
  ];
  const title =
    specs.slice(0, 2).join(" · ") || t("collab.directory.techRoleTitle");

  const location =
    tech.locationCity?.trim() ||
    tech.locationLabel?.trim() ||
    null;

  const metaTiles: DirectoryProfileMetaTile[] = [];
  if (tech.experienceYearsCount != null) {
    metaTiles.push({
      label: t("collab.directory.metaExperience"),
      value: t("collab.directory.yearsExpShort", {
        count: tech.experienceYearsCount
      })
    });
  }
  if (tech.formationTypeLabel || tech.formation) {
    metaTiles.push({
      label: t("collab.directory.metaFormation"),
      value: tech.formationTypeLabel ?? tech.formation ?? "—"
    });
  }
  if (tech.pretensionSalarialeMensuelle != null) {
    metaTiles.push({
      label: t("collab.directory.metaSalary"),
      value: `${formatFarmMoney(
        tech.pretensionSalarialeMensuelle,
        tech.pretensionCurrency
      )}${t("collab.directory.perMonthSuffix")}`
    });
  }

  return {
    name,
    title,
    photoUrl: tech.profilePhotoUrl,
    available: tech.isAvailable,
    ratingLabel: t("collab.directory.noRatings"),
    distanceLabel: formatDirectoryDistanceKm(tech.distanceKm, t),
    highlightLabel: tech.formationTypeLabel ?? specs[0] ?? null,
    highlightIcon: tech.formationTypeLabel
      ? ("school-outline" as const)
      : ("construct-outline" as const),
    locationLabel: location,
    metaTiles: metaTiles.slice(0, 3)
  };
}

export function buildVetCardModel(
  vet: VetSearchItemDto,
  t: (key: string, opts?: Record<string, unknown>) => string
) {
  const location = vet.locationLabel?.trim() || null;
  const metaTiles: DirectoryProfileMetaTile[] = [];

  if (vet.primarySpecialty) {
    metaTiles.push({
      label: t("collab.directory.metaSpecialty"),
      value: vet.primarySpecialty
    });
  }
  if (vet.ratingCount > 0) {
    metaTiles.push({
      label: t("collab.directory.metaReviews"),
      value: String(vet.ratingCount)
    });
  }
  metaTiles.push({
    label: t("collab.directory.metaStatus"),
    value: vet.isVerified
      ? t("collab.directory.verifiedShort")
      : vet.availability
        ? t("collab.directory.online")
        : t("collab.directory.offline")
  });

  return {
    name: vet.fullName,
    title: vet.primarySpecialty || t("collab.directory.vetRoleTitle"),
    photoUrl: vet.profilePhotoUrl,
    available: vet.availability,
    ratingLabel: formatDirectoryRating(vet.ratingAvg, vet.ratingCount, t),
    distanceLabel: formatDirectoryDistanceKm(vet.distanceKm, t),
    highlightLabel: vet.isVerified
      ? t("collab.directory.verifiedLong")
      : null,
    highlightIcon: "shield-checkmark-outline" as const,
    locationLabel: location,
    metaTiles: metaTiles.slice(0, 3),
    verified: vet.isVerified
  };
}
