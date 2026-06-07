import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import {
  type ClientFeatureFlags,
  FeatureFlagService
} from "./feature-flags.service";
import type { PlatformModulePublicDto } from "../feature-flags/platform-feature-flags.service";

export type ClientConfigResponse = {
  features: ClientFeatureFlags;
  modules: PlatformModulePublicDto[];
};

@Controller("config")
@SkipThrottle()
export class ConfigClientController {
  constructor(private readonly featureFlags: FeatureFlagService) {}

  @Get("client")
  async getClient(): Promise<ClientConfigResponse> {
    const [features, modules] = await Promise.all([
      this.featureFlags.getClientFeatureFlags(),
      this.featureFlags.getPlatformModules()
    ]);
    return { features, modules };
  }
}
