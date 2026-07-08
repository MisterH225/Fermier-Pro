import { validateMerchantProductFormInput } from "../merchantProductForm";

describe("validateMerchantProductFormInput", () => {
  it("accepte un produit complet", () => {
    const res = validateMerchantProductFormInput({
      name: "Maïs",
      price: "1500",
      stock: "25",
      categoryId: "cat-1"
    });
    expect(res).toEqual({ ok: true, price: 1500, stock: 25 });
  });

  it("refuse sans catégorie", () => {
    const res = validateMerchantProductFormInput({
      name: "Maïs",
      price: "1500",
      stock: "1",
      categoryId: null
    });
    expect(res).toEqual({ ok: false, errorKey: "merchant.product.errors.categoryRequired" });
  });

  it("refuse un prix vide", () => {
    const res = validateMerchantProductFormInput({
      name: "Maïs",
      price: "",
      stock: "1",
      categoryId: "cat-1"
    });
    expect(res).toEqual({ ok: false, errorKey: "merchant.product.errors.priceRequired" });
  });

  it("refuse un stock négatif", () => {
    const res = validateMerchantProductFormInput({
      name: "Maïs",
      price: "10",
      stock: "-1",
      categoryId: "cat-1"
    });
    expect(res).toEqual({ ok: false, errorKey: "merchant.product.errors.stockInvalid" });
  });
});
