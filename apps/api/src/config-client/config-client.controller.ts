import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import {
  type ClientFeatureFlags,
  FeatureFlagService
} from "./feature-flags.service";

/** Configuration exposée au client (feature flags, sans données sensibles). */
export type ClientConfigResponse = {
  features: ClientFeatureFlags;
};

@Controller("config")
@SkipThrottle()
export class ConfigClientController {
  constructor(private readonly featureFlags: FeatureFlagService) {}

  /**
   * GET /api/v1/config/client — public (pas de JWT requis).
   * Le mobile peut appeler avant connexion pour adapter menus / navigation.
   */
  @Get("client")
  getClient(): ClientConfigResponse {
    return {
      features: this.featureFlags.getClientFeatureFlags()
    };
  }
}
