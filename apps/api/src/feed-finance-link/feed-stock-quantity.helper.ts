import { BadRequestException } from "@nestjs/common";
import { FeedTypeUnit, Prisma } from "@prisma/client";

export function quantityInputToKg(
  quantityInput: number,
  quantityUnit: FeedTypeUnit,
  weightPerBagKg: Prisma.Decimal | null
): Prisma.Decimal {
  if (quantityUnit === FeedTypeUnit.sac) {
    if (!weightPerBagKg) {
      throw new BadRequestException(
        "Poids par sac requis pour une saisie en sacs"
      );
    }
    return new Prisma.Decimal(quantityInput).times(weightPerBagKg);
  }
  if (quantityUnit === FeedTypeUnit.tonne) {
    return new Prisma.Decimal(quantityInput).times(1000);
  }
  return new Prisma.Decimal(quantityInput);
}

export function lineAmountFromUnitPrice(
  quantityInput: number,
  quantityUnit: FeedTypeUnit,
  deltaKg: Prisma.Decimal,
  unitPrice: number,
  priceBasis: "kg" | "sac"
): number {
  if (priceBasis === "sac" && quantityUnit === FeedTypeUnit.sac) {
    return quantityInput * unitPrice;
  }
  return deltaKg.toNumber() * unitPrice;
}

/** Dérive le prix unitaire (par sac ou par kg selon `priceBasis`) depuis un coût total. */
export function unitPriceFromTotalCost(
  totalCost: number,
  quantityInput: number,
  quantityUnit: FeedTypeUnit,
  deltaKg: Prisma.Decimal,
  priceBasis: "kg" | "sac"
): number | null {
  if (!Number.isFinite(totalCost) || totalCost < 0) {
    return null;
  }
  if (priceBasis === "sac" && quantityUnit === FeedTypeUnit.sac) {
    if (quantityInput <= 0) {
      return null;
    }
    return totalCost / quantityInput;
  }
  if (!deltaKg.gt(0)) {
    return null;
  }
  return totalCost / deltaKg.toNumber();
}
