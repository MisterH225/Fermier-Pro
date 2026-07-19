import {
  buildTechnicianCardModel,
  buildVetCardModel,
  formatDirectoryDistanceKm,
  formatDirectoryRating,
  techSpecializationLabel
} from "../directoryCardModel";
import type { TechnicianProfileDto, VetSearchItemDto } from "../api";

const t = (key: string, opts?: Record<string, unknown>) => {
  if (key === "collab.directory.distanceKm") return `${opts?.km} km`;
  if (key === "collab.directory.ratingSummary") {
    return `${opts?.avg} (${opts?.count} avis)`;
  }
  if (key === "collab.directory.noRatings") return "Pas encore d'avis";
  if (key === "collab.directory.yearsExpShort") return `${opts?.count} ans`;
  if (key === "collab.directory.perMonthSuffix") return "/mois";
  if (key === "collab.directory.metaExperience") return "Expérience";
  if (key === "collab.directory.metaFormation") return "Formation";
  if (key === "collab.directory.metaSalary") return "Prétention";
  if (key === "collab.directory.metaSpecialty") return "Spécialité";
  if (key === "collab.directory.metaReviews") return "Avis";
  if (key === "collab.directory.metaStatus") return "Statut";
  if (key === "collab.directory.verifiedShort") return "Vérifié";
  if (key === "collab.directory.verifiedLong") return "Profil vérifié";
  if (key === "collab.directory.online") return "En ligne";
  if (key === "collab.directory.offline") return "Hors ligne";
  if (key === "collab.directory.techFallbackName") return "Technicien";
  if (key === "collab.directory.techRoleTitle") return "Technicien agricole";
  if (key === "collab.directory.vetRoleTitle") return "Vétérinaire";
  if (key.startsWith("techOnboarding.spec.")) {
    const map: Record<string, string> = {
      "techOnboarding.spec.all": "Tout terrain",
      "techOnboarding.spec.feed": "Alimentation"
    };
    return map[key] ?? String(opts?.defaultValue ?? key);
  }
  return key;
};

describe("directoryCardModel", () => {
  it("formate distance et notes", () => {
    expect(formatDirectoryDistanceKm(16.84, t)).toBe("16.8 km");
    expect(formatDirectoryDistanceKm(120.4, t)).toBe("120 km");
    expect(formatDirectoryRating(4.85, 255, t)).toBe("4,85 (255 avis)");
    expect(formatDirectoryRating(null, 0, t)).toBe("Pas encore d'avis");
  });

  it("traduit les spécialisations technicien", () => {
    expect(techSpecializationLabel("all", t)).toBe("Tout terrain");
    expect(techSpecializationLabel("custom", t)).toBe("custom");
  });

  it("construit une carte technicien avec photo, ville, formation et salaire", () => {
    const tech = {
      displayName: "Harold B.",
      specializations: ["all", "feed"],
      profilePhotoUrl: "https://example.com/a.jpg",
      isAvailable: true,
      locationCity: "Dabou",
      locationLabel: "Dabou, Côte d'Ivoire",
      formationTypeLabel: "Sur le tas",
      experienceYearsCount: 5,
      pretensionSalarialeMensuelle: 60000,
      pretensionCurrency: "XOF",
      distanceKm: 12.3
    } as TechnicianProfileDto;

    const model = buildTechnicianCardModel(tech, t);
    expect(model.name).toBe("Harold B.");
    expect(model.title).toContain("Tout terrain");
    expect(model.photoUrl).toBe("https://example.com/a.jpg");
    expect(model.locationLabel).toBe("Dabou");
    expect(model.highlightLabel).toBe("Sur le tas");
    expect(model.distanceLabel).toBe("12.3 km");
    expect(model.metaTiles.map((m) => m.label)).toEqual([
      "Expérience",
      "Formation",
      "Prétention"
    ]);
    expect(model.metaTiles[0]?.value).toBe("5 ans");
  });

  it("construit une carte vétérinaire avec notes et localité", () => {
    const vet = {
      id: "v1",
      fullName: "Dr. Putri",
      primarySpecialty: "Soins primaires",
      locationLabel: "Sunnyvale, CA",
      profilePhotoUrl: null,
      availability: true,
      isVerified: true,
      ratingAvg: 4.85,
      ratingCount: 255,
      distanceKm: 16.8
    } as VetSearchItemDto;

    const model = buildVetCardModel(vet, t);
    expect(model.name).toBe("Dr. Putri");
    expect(model.ratingLabel).toBe("4,85 (255 avis)");
    expect(model.distanceLabel).toBe("16.8 km");
    expect(model.locationLabel).toBe("Sunnyvale, CA");
    expect(model.verified).toBe(true);
    expect(model.highlightLabel).toBe("Profil vérifié");
    expect(model.metaTiles.length).toBeGreaterThan(0);
  });
});
