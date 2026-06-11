import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { AdminFeatureFlagsController } from "./admin-feature-flags.controller";
import { FeatureFlagArchiveService } from "./feature-flag-archive.service";
import { PlatformFeatureFlagsController } from "./platform-feature-flags.controller";
import { PlatformFeatureFlagsService } from "./platform-feature-flags.service";
import { PlatformModuleEnabledGuard } from "./platform-module-enabled.guard";

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [PlatformFeatureFlagsController, AdminFeatureFlagsController],
  providers: [
    PlatformFeatureFlagsService,
    FeatureFlagArchiveService,
    PlatformModuleEnabledGuard,
    SuperAdminGuard
  ],
  exports: [
    PlatformFeatureFlagsService,
    PlatformModuleEnabledGuard,
    FeatureFlagArchiveService
  ]
})
export class FeatureFlagsModule {}
