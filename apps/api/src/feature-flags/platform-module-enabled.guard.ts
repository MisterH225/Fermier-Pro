import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PlatformFeatureFlagsService } from "./platform-feature-flags.service";
import { PLATFORM_MODULE_METADATA } from "./require-platform-module.decorator";
import type { PlatformModuleId } from "./platform-modules.constants";

@Injectable()
export class PlatformModuleEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly platformFlags: PlatformFeatureFlagsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleId = this.reflector.getAllAndOverride<PlatformModuleId>(
      PLATFORM_MODULE_METADATA,
      [context.getHandler(), context.getClass()]
    );
    if (!moduleId) {
      return true;
    }
    const active = await this.platformFlags.isModuleActive(moduleId);
    if (active) {
      return true;
    }
    const message =
      (await this.platformFlags.getInactiveMessage(moduleId, "fr")) ??
      `Module ${moduleId} indisponible`;
    throw new ServiceUnavailableException({
      statusCode: 503,
      code: "MODULE_INACTIVE",
      moduleId,
      message,
      error: "Service Unavailable"
    });
  }
}
