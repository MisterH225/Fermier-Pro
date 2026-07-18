import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import {
  type ClientFeatureFlags,
  FeatureFlagService
} from "./feature-flags.service";
import type { PlatformModulePublicDto } from "../feature-flags/platform-feature-flags.service";
import {
  PlatformSettingsService,
  type SupportContactDto
} from "../platform-settings/platform-settings.service";

export type ClientPlatformFeesDto = {
  marketplaceBuyerCommissionRate: number;
  marketplaceSellerCommissionRate: number;
  vetCommissionRate: number;
};

export type ClientConfigResponse = {
  features: ClientFeatureFlags;
  modules: PlatformModulePublicDto[];
  support: SupportContactDto;
  /** Taux de commission plateforme (aperçu vendeur / véto). */
  fees: ClientPlatformFeesDto;
};

@Controller("config")
@SkipThrottle()
export class ConfigClientController {
  constructor(
    private readonly featureFlags: FeatureFlagService,
    private readonly platformSettings: PlatformSettingsService
  ) {}

  @Get("client")
  async getClient(): Promise<ClientConfigResponse> {
    const [features, modules, support, fees] = await Promise.all([
      this.featureFlags.getClientFeatureFlags(),
      this.featureFlags.getPlatformModules(),
      this.platformSettings.getSupportContact(),
      this.platformSettings.getPublicFeeRates()
    ]);
    return { features, modules, support, fees };
  }
}
