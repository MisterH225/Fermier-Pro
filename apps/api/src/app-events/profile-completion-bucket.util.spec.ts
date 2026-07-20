import {
  buyerProfileCompletionPercent,
  profileCompletionBucket,
  vetProfileCompletionPercent
} from "./profile-completion-bucket.util";

describe("profile-completion-bucket.util", () => {
  it("mappe les buckets 0-40 / 40-70 / 70-100", () => {
    expect(profileCompletionBucket(0)).toBe("0-40");
    expect(profileCompletionBucket(39)).toBe("0-40");
    expect(profileCompletionBucket(40)).toBe("40-70");
    expect(profileCompletionBucket(69)).toBe("40-70");
    expect(profileCompletionBucket(70)).toBe("70-100");
    expect(profileCompletionBucket(100)).toBe("70-100");
  });

  it("calcule un % acheteur cohérent", () => {
    const pct = buyerProfileCompletionPercent({
      buyerType: "individual",
      businessName: null,
      locationLabel: "Abidjan",
      searchRadiusKm: 20,
      preferredCategories: ["porc"],
      priceRangeMin: 1000,
      priceRangeMax: null,
      typicalVolume: "10",
      profilePhotoUrl: "https://example.com/p.jpg"
    });
    expect(pct).toBe(100);
    expect(profileCompletionBucket(pct)).toBe("70-100");
  });

  it("calcule un % véto cohérent", () => {
    const pct = vetProfileCompletionPercent({
      bio: "Dr",
      otherSpecialties: ["porcin"],
      interventionRadiusKm: 30,
      profilePhotoUrl: "https://example.com/v.jpg",
      availability: true
    });
    expect(pct).toBe(100);
  });
});
