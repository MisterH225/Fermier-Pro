import type { ClientConfigDto } from "./api";

/**
 * Source unique pour masquer les entrées métier selon `GET /config/client`.
 * Aligné sur `FarmDetailScreen`, `FarmListScreen`, etc.
 */
export function farmDetailMenuVisibility(
  features: ClientConfigDto["features"]
) {
  return {
    chat: features.chat,
    tasks: features.tasks,
    marketplace: features.marketplace,
    vetConsultations: features.vetConsultations,
    finance: features.finance,
    housing: features.housing
  };
}
