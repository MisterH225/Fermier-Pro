import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { User } from "@prisma/client";
import { PlatformFeatureFlagsService } from "./platform-feature-flags.service";
import { PLATFORM_MODULE_METADATA } from "./require-platform-module.decorator";
import type { PlatformModuleId } from "./platform-modules.constants";

type AuthedRequest = Request & { user?: User };

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
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const userId = req.user?.id;
    const active = await this.platformFlags.isModuleActiveForUser(
      moduleId,
      userId
    );
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
