import type { SellChooserChoice } from "../SellChooserSheet";

describe("SellChooserSheet choices", () => {
  it("expose exactement les deux chemins Vendre (marché / vente conclue)", () => {
    const choices: SellChooserChoice[] = ["marketplace", "recordedSale"];
    expect(choices).toHaveLength(2);
    expect(choices).toContain("marketplace");
    expect(choices).toContain("recordedSale");
  });
});
