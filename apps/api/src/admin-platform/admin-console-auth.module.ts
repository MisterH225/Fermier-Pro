import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminConsoleAccessService } from "./admin-console-access.service";
import { AdminConsoleMenuGuard } from "./admin-console-menu.guard";
import { ConsoleAccessGuard } from "./console-access.guard";
import { SuperAdminGuard } from "./super-admin.guard";

/** Guards et service d'accès console (SuperAdmin + institutions). */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    AdminConsoleAccessService,
    SuperAdminGuard,
    ConsoleAccessGuard,
    AdminConsoleMenuGuard
  ],
  exports: [
    AdminConsoleAccessService,
    SuperAdminGuard,
    ConsoleAccessGuard,
    AdminConsoleMenuGuard
  ]
})
export class AdminConsoleAuthModule {}
