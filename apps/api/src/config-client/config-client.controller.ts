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

export type ClientConfigResponse = {
  features: ClientFeatureFlags;
  modules: PlatformModulePublicDto[];
  support: SupportContactDto;
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
    const [features, modules, support] = await Promise.all([
      this.featureFlags.getClientFeatureFlags(),
      this.featureFlags.getPlatformModules(),
      this.platformSettings.getSupportContact()
    ]);
    return { features, modules, support };
  }
}
