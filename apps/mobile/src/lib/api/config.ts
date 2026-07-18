/** GET public config-client — feature flags / modules. */
import { apiBaseUrl, formatApiErrorBody } from "./http";

/** GET public (sans Bearer) — feature flags pour menus / modules. */
export type PlatformModuleId =
  | "core_producer"
  | "technician"
  | "veterinarian"
  | "marketplace"
  | "buyer"
  | "collaboration"
  | "reports"
  | "ai_assistant"
  | "pig_price_index"
  | "gestation"
  | "nutrition"
  | "wallet"
  | "merchant";

export type PlatformModuleDto = {
  moduleId: PlatformModuleId;
  moduleName: string;
  icon: string | null;
  isActive: boolean;
  canDisable: boolean;
  userMessageFr: string | null;
  userMessageEn: string | null;
  scheduledReactivation: string | null;
};

export type SupportContactDto = {
  phone: string | null;
  telegramUrl: string | null;
};

/** Taux publics depuis GET /config/client (aperçu frais). */
export type ClientPlatformFeesDto = {
  marketplaceBuyerCommissionRate: number;
  marketplaceSellerCommissionRate: number;
  vetCommissionRate: number;
};

export const DEFAULT_PLATFORM_FEES: ClientPlatformFeesDto = {
  marketplaceBuyerCommissionRate: 0.015,
  marketplaceSellerCommissionRate: 0.015,
  vetCommissionRate: 0.015
};

export type ClientConfigDto = {
  features: {
    marketplace: boolean;
    chat: boolean;
    vetConsultations: boolean;
    tasks: boolean;
    finance: boolean;
    housing: boolean;
    feedStock: boolean;
    wallet: boolean;
  };
  modules: PlatformModuleDto[];
  support?: SupportContactDto;
  fees?: ClientPlatformFeesDto;
};

export async function fetchClientConfig(): Promise<ClientConfigDto> {
  const url = `${apiBaseUrl()}/api/v1/config/client`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatApiErrorBody(text, res.status, res.statusText));
  }
  return JSON.parse(text) as ClientConfigDto;
}
