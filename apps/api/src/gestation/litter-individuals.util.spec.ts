import { createLitterPigletsInTransaction } from "./litter-individuals.util";

describe("createLitterPigletsInTransaction", () => {
  it("retourne vide si count = 0", async () => {
    const tx = {} as never;
    const result = await createLitterPigletsInTransaction(tx, {
      farmId: "farm1",
      userId: "user1",
      batchId: "batch1",
      speciesId: "species1",
      breedId: null,
      count: 0,
      birthDate: new Date("2026-06-01"),
      penId: "pen1",
      sowId: "sow1",
      sireId: null,
      transferSowWithLitter: false
    });
    expect(result).toEqual({ animalIds: [], pensToRecalculate: [] });
  });
});
