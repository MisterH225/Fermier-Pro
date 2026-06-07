import { containsPhone, maskPhoneNumbers } from "./phone-number-detector";

describe("PhoneNumberDetector", () => {
  it("masque un numéro local 10 chiffres", () => {
    const r = maskPhoneNumbers("Appelez-moi au 0708123456 pour finaliser");
    expect(r.wasModified).toBe(true);
    expect(r.maskedText).toBe("Appelez-moi au **** pour finaliser");
    expect(r.matchCount).toBe(1);
  });

  it("masque format international", () => {
    const r = maskPhoneNumbers("Tel +225 07 08 12 34 56");
    expect(r.maskedText).toContain("****");
    expect(r.wasModified).toBe(true);
  });

  it("masque deux numéros", () => {
    const r = maskPhoneNumbers("Appelez au 0708123456 ou 0102345678");
    expect(r.matchCount).toBe(2);
    expect(r.maskedText).toBe("Appelez au **** ou ****");
  });

  it("ne masque pas les prix", () => {
    const r = maskPhoneNumbers("Le prix est 50000 FCFA");
    expect(r.wasModified).toBe(false);
  });

  it("ne masque pas le poids", () => {
    expect(maskPhoneNumbers("125 kg").wasModified).toBe(false);
  });

  it("ne masque pas les dates", () => {
    expect(maskPhoneNumbers("06/06/2026").wasModified).toBe(false);
  });

  it("ne masque pas les numéros animaux", () => {
    expect(maskPhoneNumbers("Eng-012").wasModified).toBe(false);
  });

  it("conserve prix et masque numéro", () => {
    const r = maskPhoneNumbers(
      "Le prix est 50000 FCFA et mon numéro est 0708123456"
    );
    expect(r.maskedText).toContain("50000 FCFA");
    expect(r.maskedText).toContain("****");
  });

  it("containsPhone détecte sans masquer", () => {
    expect(containsPhone("0708123456")).toBe(true);
    expect(containsPhone("50000 FCFA")).toBe(false);
    expect(containsPhone("")).toBe(false);
  });
});
