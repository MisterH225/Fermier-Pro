import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  type ClientFeatureKey,
  FeatureFlagService
} from "./feature-flags.service";
import { FEATURE_FLAG_METADATA } from "./require-feature.decorator";

@Injectable()
export class FeatureEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags: FeatureFlagService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<ClientFeatureKey>(
      FEATURE_FLAG_METADATA,
      [context.getHandler(), context.getClass()]
    );
    if (!key) {
      return true;
    }
    const enabled = await this.flags.isEnabled(key);
    if (enabled) {
      return true;
    }
    const { moduleId, message } = await this.flags.resolveInactiveContext(key);
    throw new ServiceUnavailableException({
      statusCode: 503,
      code: "MODULE_INACTIVE",
      moduleId,
      feature: key,
      message: message ?? `Fonctionnalité désactivée (${key})`,
      error: "Service Unavailable"
    });
  }
}
