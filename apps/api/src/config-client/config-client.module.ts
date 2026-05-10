import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ConfigClientController } from "./config-client.controller";
import { FeatureEnabledGuard } from "./feature-enabled.guard";
import { FeatureFlagService } from "./feature-flags.service";

@Module({
  imports: [ConfigModule],
  controllers: [ConfigClientController],
  providers: [FeatureFlagService, FeatureEnabledGuard],
  exports: [FeatureFlagService, FeatureEnabledGuard]
})
export class ConfigClientModule {}
