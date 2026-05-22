import type { Ionicons } from "@expo/vector-icons";
import type { ProfileTypeChoice } from "./api";

/** Icône Ionicons par type de profil (producteur, technicien, etc.). */
export function profileTypeIcon(
  type: ProfileTypeChoice | string
): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "producer":
      return "leaf-outline";
    case "technician":
      return "construct-outline";
    case "veterinarian":
      return "medkit-outline";
    case "buyer":
      return "cart-outline";
    default:
      return "person-outline";
  }
}
