import { techMainTabFromRoute } from "../techMainTabs";

describe("techMainTabFromRoute", () => {
  it("mappe accueil et tâches", () => {
    expect(techMainTabFromRoute("TechnicianDashboard")).toBe("home");
    expect(techMainTabFromRoute("TechTasks")).toBe("tasks");
    expect(techMainTabFromRoute("FarmTasks")).toBe("tasks");
  });

  it("mappe vaccinations, pesées et stock aliment", () => {
    expect(techMainTabFromRoute("FarmHealth")).toBe("vaccinations");
    expect(techMainTabFromRoute("FarmLivestock", { initialTab: "weight" })).toBe(
      "weighings"
    );
    expect(techMainTabFromRoute("FarmFeedStock")).toBe("feedStock");
  });

  it("ne mappe pas le cheptel hors onglet pesées", () => {
    expect(techMainTabFromRoute("FarmLivestock")).toBeNull();
    expect(techMainTabFromRoute("FarmLivestock", { initialTab: "cheptel" })).toBeNull();
  });

  it("ne mappe plus ferme / suivi comme onglets principaux", () => {
    expect(techMainTabFromRoute("TechFarm")).toBeNull();
    expect(techMainTabFromRoute("TechTracking")).toBeNull();
  });

  it("retourne null hors barre", () => {
    expect(techMainTabFromRoute(undefined)).toBeNull();
    expect(techMainTabFromRoute("CommunityFeed")).toBeNull();
  });
});
