import { buyerColors } from "./buyerTheme";
import { mobileColors } from "./mobileTheme";
import { techColors } from "./technicianTheme";
import { vetColors } from "./vetTheme";

export type ProfileThemeKind = "producer" | "veterinarian" | "technician" | "buyer";

export function profileAccentColor(type: string | undefined): string {
  switch (type) {
    case "veterinarian":
      return vetColors.primary;
    case "technician":
      return techColors.primary;
    case "buyer":
      return buyerColors.primary;
    default:
      return mobileColors.accent;
  }
}
