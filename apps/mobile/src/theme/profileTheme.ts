import { buyerColors } from "./buyerTheme";
import { merchantColors } from "./merchantTheme";
import { producerColors } from "./producerTheme";
import { techColors } from "./technicianTheme";
import { vetColors } from "./vetTheme";

export type ProfileThemeKind = "producer" | "veterinarian" | "technician" | "buyer" | "merchant";

export function profileAccentColor(type: string | undefined): string {
  switch (type) {
    case "veterinarian":
      return vetColors.primary;
    case "technician":
      return techColors.primary;
    case "buyer":
      return buyerColors.primary;
    case "merchant":
      return merchantColors.primary;
    case "producer":
    default:
      return producerColors.primary;
  }
}
