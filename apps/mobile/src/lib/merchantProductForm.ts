export type ProductFormValidationResult =
  | { ok: true; price: number; stock: number }
  | { ok: false; errorKey: string };

export function validateMerchantProductFormInput(input: {
  name: string;
  price: string;
  stock: string;
  categoryId: string | null;
}): ProductFormValidationResult {
  if (!input.name.trim()) {
    return { ok: false, errorKey: "merchant.product.errors.nameRequired" };
  }
  if (!input.categoryId) {
    return { ok: false, errorKey: "merchant.product.errors.categoryRequired" };
  }
  const price = Number.parseFloat(input.price.replace(",", "."));
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, errorKey: "merchant.product.errors.priceRequired" };
  }
  const stock = Number.parseInt(input.stock.trim(), 10);
  if (!Number.isFinite(stock) || stock < 0) {
    return { ok: false, errorKey: "merchant.product.errors.stockInvalid" };
  }
  return { ok: true, price, stock };
}
