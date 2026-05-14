import type { ProducerMainTab } from "./types";

/**
 * Associe la route focalisée à un onglet principal, ou `null` si hors des 4 (menu +, listes, etc.).
 */
export function producerMainTabFromRoute(
  routeName: string,
  financeEnabled: boolean
): ProducerMainTab | null {
  switch (routeName) {
    case "ProducerDashboard":
    case "ProducerFarmSettings":
      return "home";
    case "FarmFinance":
    case "CreateFarmExpense":
    case "CreateFarmRevenue":
    case "EditFarmExpense":
    case "EditFarmRevenue":
      return financeEnabled ? "finance" : null;
    case "FarmLivestock":
    case "AnimalDetail":
    case "BatchDetail":
    case "FarmBarns":
    case "BarnDetail":
    case "PenDetail":
    case "CreateBarn":
    case "CreatePen":
    case "CreatePenLog":
    case "PenMove":
      return "cheptel";
    case "FarmHealth":
    case "FarmVetConsultations":
    case "VetConsultationDetail":
    case "CreateVetConsultation":
    case "AddVetConsultationAttachment":
      return "health";
    default:
      return null;
  }
}
