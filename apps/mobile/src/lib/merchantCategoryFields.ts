import type { MerchantCategoryDto } from "./api/merchant";

export type MerchantCategoryField = {
  key: string;
  labelKey: string;
  placeholderKey?: string;
  multiline?: boolean;
};

const CATEGORY_FIELDS: Record<string, MerchantCategoryField[]> = {
  alimentation: [
    { key: "unit", labelKey: "merchant.product.fields.unit", placeholderKey: "merchant.product.fields.unitPh" },
    { key: "expiry", labelKey: "merchant.product.fields.expiry", placeholderKey: "merchant.product.fields.expiryPh" }
  ],
  materiel: [
    { key: "brand", labelKey: "merchant.product.fields.brand", placeholderKey: "merchant.product.fields.brandPh" },
    { key: "condition", labelKey: "merchant.product.fields.condition", placeholderKey: "merchant.product.fields.conditionPh" }
  ],
  services: [
    { key: "duration", labelKey: "merchant.product.fields.duration", placeholderKey: "merchant.product.fields.durationPh" }
  ]
};

export function categoryExtraFields(category: MerchantCategoryDto | null | undefined): MerchantCategoryField[] {
  if (!category?.slug) return [];
  return CATEGORY_FIELDS[category.slug] ?? [
    { key: "details", labelKey: "merchant.product.fields.details", placeholderKey: "merchant.product.fields.detailsPh", multiline: true }
  ];
}

export function appendCategoryDetails(
  description: string | undefined,
  category: MerchantCategoryDto | null | undefined,
  extras: Record<string, string>
): string | undefined {
  const fields = categoryExtraFields(category);
  const lines = fields
    .map((f) => {
      const v = extras[f.key]?.trim();
      return v ? `${f.key}: ${v}` : null;
    })
    .filter(Boolean);
  if (!lines.length) return description?.trim() || undefined;
  const block = lines.join("\n");
  const base = description?.trim();
  return base ? `${base}\n\n${block}` : block;
}
