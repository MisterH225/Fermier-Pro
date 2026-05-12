import type { RootStackParamList } from "../types/navigation";

/** Écran d’accueil selon le type de profil actif (bottom tabs). */
export function dashboardRouteForActiveProfileType(
  type: string | undefined
): keyof RootStackParamList {
  switch (type) {
    case "producer":
      return "ProducerDashboard";
    case "buyer":
      return "BuyerDashboard";
    case "veterinarian":
      return "VeterinarianDashboard";
    case "technician":
      return "TechnicianDashboard";
    default:
      return "ProducerDashboard";
  }
}
