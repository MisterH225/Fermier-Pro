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
