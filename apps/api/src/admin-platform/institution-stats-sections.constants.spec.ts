import {
  INSTITUTION_STAT_SECTIONS,
  parseStatSectionPermissions,
  resolveStatSections,
  sanitizeStatSectionPermissions
} from "./institution-stats-sections.constants";

describe("institution-stats-sections.constants", () => {
  describe("parseStatSectionPermissions", () => {
    it("retourne un objet vide pour une entrée invalide", () => {
      expect(parseStatSectionPermissions(null)).toEqual({});
      expect(parseStatSectionPermissions([])).toEqual({});
      expect(parseStatSectionPermissions("x")).toEqual({});
    });

    it("conserve uniquement les sections connues et booléennes", () => {
      expect(
        parseStatSectionPermissions({
          mortality: true,
          economy: false,
          unknown: true,
          herd: "read"
        })
      ).toEqual({
        mortality: true,
        economy: false
      });
    });
  });

  describe("sanitizeStatSectionPermissions", () => {
    it("rejette une section inconnue", () => {
      expect(
        sanitizeStatSectionPermissions({
          mortality: true,
          fakeSection: true
        })
      ).toEqual({ mortality: true });
    });
  });

  describe("resolveStatSections", () => {
    it("superadmin voit toutes les sections", () => {
      expect(
        resolveStatSections({
          role: "superadmin",
          permissions: "all",
          statSectionPermissions: "all"
        })
      ).toEqual([...INSTITUTION_STAT_SECTIONS]);
    });

    it("deny-by-default : institution sans section accordée", () => {
      expect(
        resolveStatSections({
          role: "institution",
          permissions: { stats: "read" },
          statSectionPermissions: {}
        })
      ).toEqual([]);
    });

    it("deny-by-default : section absente du JSON", () => {
      expect(
        resolveStatSections({
          role: "institution",
          permissions: { stats: "read" },
          statSectionPermissions: { mortality: true }
        })
      ).toEqual(["mortality"]);
    });

    it("refuse les sections si le menu stats n'est pas accordé", () => {
      expect(
        resolveStatSections({
          role: "institution",
          permissions: { map: "read" },
          statSectionPermissions: { mortality: true, herd: true }
        })
      ).toEqual([]);
    });

    it("intersection menu stats + section true", () => {
      expect(
        resolveStatSections({
          role: "institution",
          permissions: { stats: "write" },
          statSectionPermissions: {
            mortality: true,
            herd: false,
            economy: true
          }
        })
      ).toEqual(["mortality", "economy"]);
    });
  });
});
