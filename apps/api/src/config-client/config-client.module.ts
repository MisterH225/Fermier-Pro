import { Module } from "@nestjs/common";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { ConfigClientController } from "./config-client.controller";
import { FeatureEnabledGuard } from "./feature-enabled.guard";
import { FeatureFlagService } from "./feature-flags.service";

@Module({
  imports: [FeatureFlagsModule],
  controllers: [ConfigClientController],
  providers: [FeatureFlagService, FeatureEnabledGuard],
  exports: [FeatureFlagService, FeatureEnabledGuard]
})
export class ConfigClientModule {}
